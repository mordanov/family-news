import pytest
import io
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.auth import hash_password, verify_password, create_access_token, decode_token
from app.services.photos import generate_filename, delete_photo_files


# ── Auth tests ──────────────────────────────────────────────────────────────

def test_hash_and_verify_password():
    pw = "secret123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_create_and_decode_token():
    data = {"sub": "admin", "user_id": 1}
    token = create_access_token(data)
    assert isinstance(token, str)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin"
    assert decoded["user_id"] == 1


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
        "photos": None,
    }
    from app.api.news import format_news
    result = format_news(item)
    assert result["id"] == 1
    assert result["photos"] == []
    assert result["author"] == "admin"
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
        "photos": [
            {"id": 10, "filename": "abc.jpg", "thumbnail_filename": "thumb_abc.jpg"},
        ],
    }
    result = format_news(item)
    assert len(result["photos"]) == 1
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
