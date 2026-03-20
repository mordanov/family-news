from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import json

from app.api.auth import get_current_user
from app.database import get_pool
from app.services import news as news_svc, photos as photo_svc
from app.config import NEWS_COLORS, DEFAULT_COLOR

router = APIRouter(prefix="/api/news", tags=["news"])


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
    return {
        "id": photo["id"],
        "url": f"/photos/{photo['filename']}",
        "thumbnail_url": f"/photos/thumbnails/{photo['thumbnail_filename']}",
    }


def format_news(item: dict) -> dict:
    photos = item.get("photos") or []
    normalized_photos = [p for p in (_normalize_photo(photo) for photo in photos) if p is not None]
    return {
        "id": item["id"],
        "description": item["description"],
        "color": item["color"],
        "created_at": item["created_at"].isoformat() if item["created_at"] else None,
        "updated_at": item["updated_at"].isoformat() if item["updated_at"] else None,
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
    photos: list[UploadFile] = File(default=[]),
    _=Depends(get_current_user)
):
    pool = await get_pool()
    news_id = await news_svc.create_news(pool, description, color)
    for photo in photos[:10]:
        content = await photo.read()
        if content:
            filename, thumb = await photo_svc.save_photo(content, photo.filename or "photo.jpg")
            await news_svc.add_photo(pool, news_id, filename, thumb)
    item = await news_svc.get_news_by_id(pool, news_id)
    return format_news(item)


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
    new_photos: list[UploadFile] = File(default=[]),
    delete_photo_ids: str = Form(default="[]"),
    _=Depends(get_current_user)
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
    remaining_slots = max(0, 10 - current_count + len(to_delete))
    for photo in new_photos[:remaining_slots]:
        content = await photo.read()
        if content:
            filename, thumb = await photo_svc.save_photo(content, photo.filename or "photo.jpg")
            await news_svc.add_photo(pool, news_id, filename, thumb)

    await news_svc.update_news(pool, news_id, description, color)
    item = await news_svc.get_news_by_id(pool, news_id)
    return format_news(item)


@router.delete("/{news_id}", status_code=204)
async def delete_news(news_id: int, _=Depends(get_current_user)):
    pool = await get_pool()
    photos = await news_svc.get_news_photos(pool, news_id)
    deleted = await news_svc.delete_news(pool, news_id)
    if not deleted:
        raise HTTPException(404, "Новость не найдена")
    for p in photos:
        photo_svc.delete_photo_files(p["filename"], p["thumbnail_filename"])


@router.delete("/{news_id}/photos/{photo_id}", status_code=204)
async def delete_photo(news_id: int, photo_id: int, _=Depends(get_current_user)):
    pool = await get_pool()
    deleted = await news_svc.delete_photo(pool, photo_id)
    if not deleted:
        raise HTTPException(404, "Фото не найдено")
    photo_svc.delete_photo_files(deleted["filename"], deleted["thumbnail_filename"])


@router.get("/meta/colors")
async def get_colors(_=Depends(get_current_user)):
    return NEWS_COLORS
