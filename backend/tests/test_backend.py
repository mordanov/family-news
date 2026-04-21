import pytest
import io
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from PIL import Image
from starlette.datastructures import UploadFile
from app.services.auth import hash_password, verify_password, create_access_token, decode_token
from app.services.photos import generate_filename, delete_photo_files, save_photo, save_media
from fastapi import HTTPException


# ── Auth tests ──────────────────────────────────────────────────────────────

def test_hash_and_verify_password():
    pw = "secret123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_create_and_decode_token():
    data = {"sub": "admin", "user_id": 1, "role": "full_access"}
    token = create_access_token(data)
    assert isinstance(token, str)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin"
    assert decoded["user_id"] == 1
    assert decoded["role"] == "full_access"


def test_decode_invalid_token():
    result = decode_token("not.a.valid.token")
    assert result is None


def test_decode_tampered_token():
    token = create_access_token({"sub": "admin"})
    tampered = token[:-4] + "xxxx"
    result = decode_token(tampered)
    assert result is None


# ── Photo service tests ──────────────────────────────────────────────────────

def test_generate_filename_preserves_extension():
    filename, thumb = generate_filename("photo.jpg")
    assert filename.endswith(".jpg")
    assert thumb.startswith("thumb_")
    assert thumb.endswith(".jpg")


def test_generate_filename_unique():
    f1, _ = generate_filename("img.png")
    f2, _ = generate_filename("img.png")
    assert f1 != f2


def test_generate_filename_default_ext():
    filename, thumb = generate_filename("no_extension")
    assert filename.endswith(".jpg")


def test_detect_media_kind_by_mime():
    from app.services.photos import detect_media_kind

    assert detect_media_kind("image/jpeg") == "image"
    assert detect_media_kind("video/mp4") == "video"
    assert detect_media_kind("audio/mpeg") == "audio"
    assert detect_media_kind("application/pdf") is None


def test_video_thumbnail_name_uses_jpg_extension():
    filename, thumb = generate_filename("abc123.mp4", media_kind="video")
    assert filename.endswith(".mp4")
    assert thumb.endswith(".jpg")


def test_delete_photo_files_missing_files():
    # Should not raise even if files don't exist
    delete_photo_files("nonexistent.jpg", "thumb_nonexistent.jpg")


def test_delete_photo_files_existing(tmp_path):
    f = tmp_path / "photo.jpg"
    t = tmp_path / "thumb.jpg"
    f.write_bytes(b"data")
    t.write_bytes(b"data")

    with patch("app.services.photos.PHOTOS_DIR", str(tmp_path)), \
         patch("app.services.photos.THUMBNAILS_DIR", str(tmp_path)):
        delete_photo_files("photo.jpg", "thumb.jpg")

    assert not f.exists()
    assert not t.exists()


@pytest.mark.asyncio
async def test_save_photo_thumbnail_applies_exif_orientation(tmp_path):
    src = Image.new("RGB", (120, 60), color="red")
    exif = src.getexif()
    exif[274] = 6  # 90° rotation via EXIF Orientation

    buf = io.BytesIO()
    src.save(buf, format="JPEG", exif=exif)
    payload = buf.getvalue()

    with patch("app.services.photos.PHOTOS_DIR", str(tmp_path)), \
         patch("app.services.photos.THUMBNAILS_DIR", str(tmp_path / "thumbs")):
        _, thumb_name = await save_photo(payload, "photo.jpg")

    thumb_path = tmp_path / "thumbs" / thumb_name
    assert thumb_path.exists()

    with Image.open(thumb_path) as thumb:
        # Without EXIF transpose this would remain landscape (120, 60).
        assert thumb.height > thumb.width


@pytest.mark.asyncio
async def test_save_media_video_generates_thumbnail_with_ffmpeg(tmp_path):
    payload = b"fake-video-bytes"

    with patch("app.services.photos.PHOTOS_DIR", str(tmp_path)), \
         patch("app.services.photos.THUMBNAILS_DIR", str(tmp_path / "thumbs")), \
         patch("app.services.photos._transcode_video", new=AsyncMock(return_value=True)), \
         patch("app.services.photos._generate_video_thumbnail", new=AsyncMock(return_value=True)) as gen_thumb:
        filename, thumb, media_kind = await save_media(payload, "clip.mp4", "video/mp4")

    assert media_kind == "video"
    assert filename.endswith(".mp4")
    assert thumb.endswith(".jpg")
    gen_thumb.assert_called_once()


# ── News service tests ───────────────────────────────────────────────────────

def test_format_news_item_no_photos():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    item = {
        "id": 1,
        "description": "Test",
        "color": "amber",
        "created_at": now,
        "updated_at": now,
        "author": "admin",
        "is_published": False,
        "public_token": None,
        "photos": None,
    }
    from app.api.news import format_news
    result = format_news(item)
    assert result["id"] == 1
    assert result["photos"] == []
    assert result["author"] == "admin"
    assert result["is_published"] is False
    assert result["public_token"] is None
    assert "created_at" in result


def test_format_news_item_with_photos():
    from datetime import datetime, timezone
    from app.api.news import format_news
    now = datetime.now(timezone.utc)
    item = {
        "id": 2,
        "description": "With photos",
        "color": "teal",
        "created_at": now,
        "updated_at": now,
        "is_published": True,
        "public_token": "abc-token",
        "photos": [
            {"id": 10, "filename": "abc.jpg", "thumbnail_filename": "thumb_abc.jpg"},
        ],
    }
    result = format_news(item)
    assert len(result["photos"]) == 1
    assert result["is_published"] is True
    assert result["public_token"] == "abc-token"
    assert result["photos"][0]["url"] == "/api/photos/abc.jpg"
    assert result["photos"][0]["thumbnail_url"] == "/api/photos/thumbnails/thumb_abc.jpg"


def test_format_news_item_with_stringified_photos():
    from datetime import datetime, timezone
    from app.api.news import format_news
    now = datetime.now(timezone.utc)
    item = {
        "id": 3,
        "description": "Stringified photos",
        "color": "blue",
        "created_at": now,
        "updated_at": now,
        "photos": [
            '{"id": 42, "filename": "x.jpg", "thumbnail_filename": "thumb_x.jpg"}',
        ],
    }
    result = format_news(item)
    assert len(result["photos"]) == 1
    assert result["photos"][0]["id"] == 42
    assert result["photos"][0]["url"] == "/api/photos/x.jpg"


def test_parse_publish_flag_truthy_values():
    from app.api.news import _parse_publish_flag

    assert _parse_publish_flag("true") is True
    assert _parse_publish_flag("1") is True
    assert _parse_publish_flag("on") is True


def test_parse_publish_flag_falsey_values():
    from app.api.news import _parse_publish_flag

    assert _parse_publish_flag(None) is False
    assert _parse_publish_flag("false") is False
    assert _parse_publish_flag("0") is False


@pytest.mark.asyncio
async def test_save_single_media_returns_none_for_empty_file():
    from app.api.news import _save_single_media

    upload = UploadFile(filename="empty.jpg", file=io.BytesIO(b""), content_type="image/jpeg")
    with patch("app.api.news.photo_svc.save_media_from_file", new=AsyncMock()) as save_mock, \
         patch("app.api.news.news_svc.add_photo", new=AsyncMock()) as add_photo_mock:
        result = await _save_single_media(object(), 123, upload)

    assert result is None
    save_mock.assert_not_called()
    add_photo_mock.assert_not_called()


@pytest.mark.asyncio
async def test_save_single_media_persists_file_metadata():
    from app.api.news import _save_single_media

    upload = UploadFile(filename="photo.jpg", file=io.BytesIO(b"abc"), content_type="image/jpeg")
    with patch("app.api.news.photo_svc.save_media_from_file", new=AsyncMock(return_value=("f.jpg", "thumb_f.jpg", "image"))), \
         patch("app.api.news.news_svc.add_photo", new=AsyncMock(return_value=77)):
        result = await _save_single_media(object(), 55, upload)

    assert result["id"] == 77
    assert result["filename"] == "f.jpg"
    assert result["thumbnail_filename"] == "thumb_f.jpg"
    assert result["media_kind"] == "image"
    assert result["mime_type"] == "image/jpeg"
    assert result["size_bytes"] == 3


def test_generate_public_token_is_uuid():
    from uuid import UUID
    from app.services.news import _generate_public_token

    token = _generate_public_token()
    assert str(UUID(token)) == token


# ── Config tests ─────────────────────────────────────────────────────────────

def test_news_colors_have_required_fields():
    from app.config import NEWS_COLORS
    for color in NEWS_COLORS:
        assert "id" in color
        assert "label" in color
        assert "value" in color
        assert color["value"].startswith("#")


def test_default_color_in_palette():
    from app.config import NEWS_COLORS, DEFAULT_COLOR
    ids = [c["id"] for c in NEWS_COLORS]
    assert DEFAULT_COLOR in ids


def test_dynamic_api_responses_disable_cache_headers():
    from app.main import app

    @asynccontextmanager
    async def no_lifespan(_app):
        yield

    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = no_lifespan
    try:
        with TestClient(app) as client:
            response = client.get("/api/health")
    finally:
        app.router.lifespan_context = original_lifespan

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, no-cache, must-revalidate, max-age=0"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["Expires"] == "0"


# ── Roles & users tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_require_full_access_allows_admin_role():
    from app.api.auth import require_full_access

    user = {"user_id": 1, "sub": "admin", "role": "full_access"}
    result = await require_full_access(user)
    assert result == user


@pytest.mark.asyncio
async def test_require_full_access_blocks_read_only():
    from app.api.auth import require_full_access

    with pytest.raises(HTTPException) as ex:
        await require_full_access({"user_id": 2, "sub": "reader", "role": "read_only"})

    assert ex.value.status_code == 403


def test_validate_role_accepts_known_values():
    from app.api.users import _validate_role

    assert _validate_role("full_access") == "full_access"
    assert _validate_role("read_only") == "read_only"


def test_validate_role_rejects_unknown_value():
    from app.api.users import _validate_role

    with pytest.raises(HTTPException) as ex:
        _validate_role("owner")

    assert ex.value.status_code == 400


