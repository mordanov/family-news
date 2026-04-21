import asyncio
import os
import shutil
import uuid

import aiofiles
from PIL import Image, ImageOps

from app.config import (
    PHOTOS_DIR,
    THUMBNAILS_DIR,
    THUMBNAIL_SIZE,
    ALLOWED_IMAGE_MIME,
    ALLOWED_VIDEO_MIME,
    ALLOWED_AUDIO_MIME,
    IMAGE_MAX_DIMENSION,
    IMAGE_QUALITY,
    VIDEO_MAX_HEIGHT,
    VIDEO_CRF,
    VIDEO_PRESET,
)


def ensure_dirs():
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)


def generate_filename(original_filename: str, media_kind: str = "") -> tuple[str, str]:
    ext = os.path.splitext(original_filename)[1].lower() or ".jpg"
    if media_kind == "video":
        ext = ".mp4"
    name = uuid.uuid4().hex
    thumb_ext = ".jpg" if media_kind in ("image", "video") else ext
    return f"{name}{ext}", f"thumb_{name}{thumb_ext}"


def detect_media_kind(mime_type: str | None) -> str | None:
    if not mime_type:
        return None
    normalized = mime_type.lower()
    if normalized in ALLOWED_IMAGE_MIME:
        return "image"
    if normalized in ALLOWED_VIDEO_MIME:
        return "video"
    if normalized in ALLOWED_AUDIO_MIME:
        return "audio"
    return None


def _guess_mime_by_ext(filename: str) -> str:
    ext = (os.path.splitext(filename)[1] or "").lower()
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    if ext == ".gif":
        return "image/gif"
    if ext == ".mp4":
        return "video/mp4"
    if ext == ".webm":
        return "video/webm"
    if ext == ".mov":
        return "video/quicktime"
    if ext == ".mp3":
        return "audio/mpeg"
    if ext in {".m4a", ".aac"}:
        return "audio/x-m4a"
    if ext == ".wav":
        return "audio/wav"
    if ext == ".ogg":
        return "audio/ogg"
    return "application/octet-stream"


async def _run_ffmpeg(*args: str) -> bool:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", *args,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    return proc.returncode == 0


async def _generate_video_thumbnail(video_path: str, thumbnail_path: str) -> bool:
    return await _run_ffmpeg(
        "-y", "-ss", "00:00:01",
        "-i", video_path,
        "-frames:v", "1",
        "-vf", f"scale={THUMBNAIL_SIZE[0]}:{THUMBNAIL_SIZE[1]}:force_original_aspect_ratio=decrease",
        thumbnail_path,
    )


def _optimize_image_sync(src_path: str, dst_path: str):
    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    w, h = img.size
    if w > IMAGE_MAX_DIMENSION or h > IMAGE_MAX_DIMENSION:
        ratio = min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    img.save(dst_path, "JPEG", quality=IMAGE_QUALITY, optimize=True)


def _make_image_thumbnail_sync(photo_path: str, thumb_path: str):
    img = Image.open(photo_path)
    img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
    img.save(thumb_path, "JPEG", quality=85)


async def _transcode_video(src_path: str, dst_path: str) -> bool:
    scale_filter = f"scale=-2:min(ih\\,{VIDEO_MAX_HEIGHT})"
    return await _run_ffmpeg(
        "-y", "-i", src_path,
        "-vf", scale_filter,
        "-c:v", "libx264",
        "-crf", str(VIDEO_CRF),
        "-preset", VIDEO_PRESET,
        "-c:a", "aac",
        "-movflags", "+faststart",
        dst_path,
    )


async def save_media_from_file(
    temp_path: str,
    original_filename: str,
    mime_type: str | None,
) -> tuple[str, str, str]:
    """Process a media file already on disk and store it optimised in PHOTOS_DIR."""
    ensure_dirs()
    media_kind = detect_media_kind(mime_type)
    if not media_kind:
        raise ValueError("Неподдерживаемый тип файла")

    filename, thumb_filename = generate_filename(original_filename, media_kind)
    photo_path = os.path.join(PHOTOS_DIR, filename)
    thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)

    if media_kind == "image":
        await asyncio.to_thread(_optimize_image_sync, temp_path, photo_path)
        await asyncio.to_thread(_make_image_thumbnail_sync, photo_path, thumb_path)

    elif media_kind == "video":
        ok = await _transcode_video(temp_path, photo_path)
        if not ok:
            shutil.copy2(temp_path, photo_path)
        thumb_ok = await _generate_video_thumbnail(photo_path, thumb_path)
        if not thumb_ok:
            thumb_filename = filename

    else:  # audio
        shutil.copy2(temp_path, photo_path)
        thumb_filename = filename

    return filename, thumb_filename, media_kind


async def save_media(
    file_bytes: bytes,
    original_filename: str,
    mime_type: str | None,
) -> tuple[str, str, str]:
    """Bytes-based wrapper kept for backward compatibility."""
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        return await save_media_from_file(tmp_path, original_filename, mime_type)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def save_photo(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    filename, thumb_filename, _ = await save_media(
        file_bytes, original_filename, _guess_mime_by_ext(original_filename)
    )
    return filename, thumb_filename


def delete_photo_files(filename: str, thumbnail_filename: str):
    paths = {os.path.join(PHOTOS_DIR, filename)}
    if thumbnail_filename and thumbnail_filename != filename:
        paths.add(os.path.join(THUMBNAILS_DIR, thumbnail_filename))
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
