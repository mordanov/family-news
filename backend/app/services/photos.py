import os
import subprocess
import uuid
import aiofiles
from PIL import Image, ImageOps
import io
from app.config import (
    PHOTOS_DIR,
    THUMBNAILS_DIR,
    THUMBNAIL_SIZE,
    ALLOWED_IMAGE_MIME,
    ALLOWED_VIDEO_MIME,
    ALLOWED_AUDIO_MIME,
)


def ensure_dirs():
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)


def generate_filename(original_filename: str) -> tuple[str, str]:
    ext = os.path.splitext(original_filename)[1].lower() or ".jpg"
    name = uuid.uuid4().hex
    return f"{name}{ext}", f"thumb_{name}{ext}"


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


def _video_thumbnail_name(filename: str) -> str:
    base = os.path.splitext(os.path.basename(filename))[0]
    return f"thumb_{base}.jpg"


def generate_video_thumbnail(video_path: str, thumbnail_path: str):
    # Extract one frame near the beginning to avoid black first-frame previews.
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "00:00:01",
            "-i",
            video_path,
            "-frames:v",
            "1",
            "-vf",
            f"scale={THUMBNAIL_SIZE[0]}:{THUMBNAIL_SIZE[1]}:force_original_aspect_ratio=decrease",
            thumbnail_path,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def save_photo(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    filename, thumb_filename, _ = await save_media(file_bytes, original_filename, _guess_mime_by_ext(original_filename))
    return filename, thumb_filename


async def save_media(file_bytes: bytes, original_filename: str, mime_type: str | None) -> tuple[str, str, str]:
    ensure_dirs()
    media_kind = detect_media_kind(mime_type)
    if not media_kind:
        raise ValueError("Неподдерживаемый тип файла")

    filename, thumb_filename = generate_filename(original_filename)

    photo_path = os.path.join(PHOTOS_DIR, filename)
    async with aiofiles.open(photo_path, "wb") as f:
        await f.write(file_bytes)

    if media_kind == "image":
        # Generate thumbnail synchronously (Pillow is sync)
        img = Image.open(io.BytesIO(file_bytes))
        # Apply EXIF orientation so generated thumbnails match how originals are displayed.
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
        thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
        img.save(thumb_path, "JPEG", quality=85)
    elif media_kind == "video":
        thumb_filename = _video_thumbnail_name(filename)
        thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
        try:
            generate_video_thumbnail(photo_path, thumb_path)
        except Exception:
            # If ffmpeg fails, frontend can still render video directly.
            thumb_filename = filename
    else:
        # Audio has no visual preview frame; frontend uses an audio badge.
        thumb_filename = filename

    return filename, thumb_filename, media_kind


def delete_photo_files(filename: str, thumbnail_filename: str):
    paths = {
        os.path.join(PHOTOS_DIR, filename),
    }
    if thumbnail_filename and thumbnail_filename != filename:
        paths.add(os.path.join(THUMBNAILS_DIR, thumbnail_filename))

    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
