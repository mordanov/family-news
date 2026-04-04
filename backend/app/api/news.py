from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from typing import Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import json

_TIMEZONE = ZoneInfo("Europe/Madrid")

from app.api.auth import get_current_user, require_full_access
from app.database import get_pool
from app.services import news as news_svc, photos as photo_svc, fcm
from app.config import (
    NEWS_COLORS,
    DEFAULT_COLOR,
    ALLOWED_IMAGE_MIME,
    ALLOWED_VIDEO_MIME,
    ALLOWED_AUDIO_MIME,
    MAX_IMAGE_BYTES,
    MAX_VIDEO_BYTES,
    MAX_AUDIO_BYTES,
)

router = APIRouter(prefix="/api/news", tags=["news"])
MAX_NEWS_PHOTOS = 100
ALLOWED_MEDIA_MIME = ALLOWED_IMAGE_MIME | ALLOWED_VIDEO_MIME | ALLOWED_AUDIO_MIME


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse datetime-local string (Europe/Madrid), return UTC-aware datetime."""
    if not value:
        return None
    try:
        naive = datetime.fromisoformat(value)
        return naive.replace(tzinfo=_TIMEZONE).astimezone(timezone.utc)
    except ValueError:
        return None


def _normalize_photo(photo: dict | str) -> Optional[dict]:
    if isinstance(photo, str):
        try:
            photo = json.loads(photo)
        except Exception:
            return None
    if not isinstance(photo, dict):
        return None
    if "id" not in photo or "filename" not in photo or "thumbnail_filename" not in photo:
        return None

    media_kind = photo.get("media_kind")
    if not media_kind:
        mime_type = (photo.get("mime_type") or "").lower()
        if mime_type.startswith("video/"):
            media_kind = "video"
        elif mime_type.startswith("audio/"):
            media_kind = "audio"
        else:
            media_kind = "image"

    thumb_name = photo.get("thumbnail_filename")
    thumbnail_url = None
    if media_kind in {"image", "video"} and thumb_name:
        if thumb_name == photo.get("filename") and media_kind == "video":
            thumbnail_url = f"/api/photos/{photo['filename']}"
        else:
            thumbnail_url = f"/api/photos/thumbnails/{thumb_name}"
    return {
        "id": photo["id"],
        "media_kind": media_kind,
        "mime_type": photo.get("mime_type"),
        "size_bytes": int(photo.get("size_bytes") or 0),
        "url": f"/api/photos/{photo['filename']}",
        "thumbnail_url": thumbnail_url,
    }


def _validate_upload(media_file: UploadFile, content: bytes):
    mime_type = (media_file.content_type or "").lower()
    if mime_type not in ALLOWED_MEDIA_MIME:
        raise HTTPException(400, f"Неподдерживаемый тип файла: {mime_type or 'unknown'}")

    size = len(content)
    if mime_type in ALLOWED_IMAGE_MIME and size > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Слишком большое изображение")
    if mime_type in ALLOWED_VIDEO_MIME and size > MAX_VIDEO_BYTES:
        raise HTTPException(400, "Слишком большое видео")
    if mime_type in ALLOWED_AUDIO_MIME and size > MAX_AUDIO_BYTES:
        raise HTTPException(400, "Слишком большой аудиофайл")

    return mime_type


def _parse_publish_flag(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def _save_single_media(pool, news_id: int, media_file: UploadFile) -> Optional[dict]:
    content = await media_file.read()
    if not content:
        return None

    mime_type = _validate_upload(media_file, content)
    filename, thumb, media_kind = await photo_svc.save_media(
        content,
        media_file.filename or "file.bin",
        mime_type,
    )
    media_id = await news_svc.add_photo(pool, news_id, filename, thumb, media_kind, mime_type, len(content))
    return {
        "id": media_id,
        "filename": filename,
        "thumbnail_filename": thumb,
        "media_kind": media_kind,
        "mime_type": mime_type,
        "size_bytes": len(content),
    }


def format_news(item: dict) -> dict:
    attachments = item.get("photos") or []
    normalized_media = [p for p in (_normalize_photo(photo) for photo in attachments) if p is not None]
    normalized_photos = [m for m in normalized_media if m.get("media_kind") == "image"]
    return {
        "id": item["id"],
        "description": item["description"],
        "color": item["color"],
        "created_at": item["created_at"].isoformat() if item["created_at"] else None,
        "updated_at": item["updated_at"].isoformat() if item["updated_at"] else None,
        "author": item.get("author"),
        "is_published": bool(item.get("is_published")),
        "public_token": item.get("public_token"),
        "media": normalized_media,
        "photos": normalized_photos,
    }


@router.get("")
async def list_news(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    _=Depends(get_current_user)
):
    pool = await get_pool()
    total, items = await news_svc.get_news_list(pool, page, per_page)
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total + per_page - 1) // per_page),
        "items": [format_news(i) for i in items],
    }


@router.post("", status_code=201)
async def create_news(
    description: str = Form(...),
    color: str = Form(DEFAULT_COLOR),
    created_at: Optional[str] = Form(default=None),
    is_published: Optional[str] = Form(default=None),
    photos: list[UploadFile] = File(default=[]),
    media: list[UploadFile] = File(default=[]),
    current_user=Depends(require_full_access)
):
    pool = await get_pool()
    parsed_dt = _parse_datetime(created_at)
    parsed_publish = _parse_publish_flag(is_published)
    author = str(current_user["sub"])
    news_id = await news_svc.create_news(pool, description, author, color, parsed_dt, parsed_publish)
    upload_items = [*media, *photos]
    for media_file in upload_items[:MAX_NEWS_PHOTOS]:
        await _save_single_media(pool, news_id, media_file)
    item = await news_svc.get_news_by_id(pool, news_id)

    # Send FCM notification if news is published
    if parsed_publish:
        await fcm.send_news_notification(
            pool,
            news_id,
            description,
            author,
            parsed_dt.isoformat() if parsed_dt else None,
        )

    return format_news(item)


@router.post("/{news_id}/media", status_code=201)
async def upload_news_media(
    news_id: int,
    media_file: UploadFile = File(...),
    _=Depends(require_full_access),
):
    pool = await get_pool()
    item = await news_svc.get_news_by_id(pool, news_id)
    if not item:
        raise HTTPException(404, "Новость не найдена")

    current_count = len(item.get("photos") or [])
    if current_count >= MAX_NEWS_PHOTOS:
        raise HTTPException(400, "Достигнут лимит файлов для новости")

    saved = await _save_single_media(pool, news_id, media_file)
    if not saved:
        raise HTTPException(400, "Пустой файл")

    return _normalize_photo(saved)


@router.get("/{news_id}")
async def get_news(news_id: int, _=Depends(get_current_user)):
    pool = await get_pool()
    item = await news_svc.get_news_by_id(pool, news_id)
    if not item:
        raise HTTPException(404, "Новость не найдена")
    return format_news(item)


@router.put("/{news_id}")
async def update_news(
    news_id: int,
    description: str = Form(...),
    color: str = Form(DEFAULT_COLOR),
    created_at: Optional[str] = Form(default=None),
    is_published: Optional[str] = Form(default=None),
    new_photos: list[UploadFile] = File(default=[]),
    new_media: list[UploadFile] = File(default=[]),
    delete_photo_ids: str = Form(default="[]"),
    _=Depends(require_full_access)
):
    pool = await get_pool()
    item = await news_svc.get_news_by_id(pool, news_id)
    if not item:
        raise HTTPException(404, "Новость не найдена")

    # Delete specified photos
    try:
        to_delete = json.loads(delete_photo_ids)
    except Exception:
        to_delete = []

    for pid in to_delete:
        deleted = await news_svc.delete_photo(pool, pid)
        if deleted:
            photo_svc.delete_photo_files(deleted["filename"], deleted["thumbnail_filename"])

    # Add new photos
    current_count = len((item.get("photos") or []))
    remaining_slots = max(0, MAX_NEWS_PHOTOS - current_count + len(to_delete))
    upload_items = [*new_media, *new_photos]
    for media_file in upload_items[:remaining_slots]:
        await _save_single_media(pool, news_id, media_file)

    # Check if we're publishing a previously unpublished news
    was_published = bool(item.get("is_published"))
    new_published = _parse_publish_flag(is_published)
    
    await news_svc.update_news(
        pool,
        news_id,
        description,
        color,
        _parse_datetime(created_at),
        new_published,
        item.get("public_token"),
    )
    item = await news_svc.get_news_by_id(pool, news_id)

    # Send FCM notification if news was just published (wasn't published before)
    if new_published and not was_published:
        await fcm.send_news_notification(
            pool,
            news_id,
            description,
            item.get("author", "admin"),
            item.get("created_at", "").isoformat() if item.get("created_at") else None,
        )

    return format_news(item)


@router.get("/public/{public_token}")
async def get_public_news(public_token: str):
    pool = await get_pool()
    item = await news_svc.get_news_by_public_token(pool, public_token)
    if not item:
        raise HTTPException(404, "Публичная новость не найдена")
    return format_news(item)


@router.post("/{news_id}/public-link/rotate")
async def rotate_public_link(news_id: int, _=Depends(require_full_access)):
    pool = await get_pool()
    item = await news_svc.get_news_by_id(pool, news_id)
    if not item:
        raise HTTPException(404, "Новость не найдена")
    if not item.get("is_published"):
        raise HTTPException(409, "Новость не опубликована")

    await news_svc.rotate_public_token(pool, news_id)
    updated_item = await news_svc.get_news_by_id(pool, news_id)
    return format_news(updated_item)


@router.delete("/{news_id}", status_code=204)
async def delete_news(news_id: int, _=Depends(require_full_access)):
    pool = await get_pool()
    photos = await news_svc.get_news_photos(pool, news_id)
    deleted = await news_svc.delete_news(pool, news_id)
    if not deleted:
        raise HTTPException(404, "Новость не найдена")
    for p in photos:
        photo_svc.delete_photo_files(p["filename"], p["thumbnail_filename"])


@router.delete("/{news_id}/photos/{photo_id}", status_code=204)
async def delete_photo(news_id: int, photo_id: int, _=Depends(require_full_access)):
    pool = await get_pool()
    deleted = await news_svc.delete_photo(pool, photo_id)
    if not deleted:
        raise HTTPException(404, "Фото не найдено")
    photo_svc.delete_photo_files(deleted["filename"], deleted["thumbnail_filename"])


@router.get("/meta/colors")
async def get_colors():
    return NEWS_COLORS
