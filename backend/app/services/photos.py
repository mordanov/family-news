import os
import uuid
import aiofiles
from PIL import Image, ImageOps
import io
from app.config import PHOTOS_DIR, THUMBNAILS_DIR, THUMBNAIL_SIZE


def ensure_dirs():
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)


def generate_filename(original_filename: str) -> tuple[str, str]:
    ext = os.path.splitext(original_filename)[1].lower() or ".jpg"
    name = uuid.uuid4().hex
    return f"{name}{ext}", f"thumb_{name}{ext}"


async def save_photo(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    ensure_dirs()
    filename, thumb_filename = generate_filename(original_filename)

    photo_path = os.path.join(PHOTOS_DIR, filename)
    async with aiofiles.open(photo_path, "wb") as f:
        await f.write(file_bytes)

    # Generate thumbnail synchronously (Pillow is sync)
    img = Image.open(io.BytesIO(file_bytes))
    # Apply EXIF orientation so generated thumbnails match how originals are displayed.
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
    thumb_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
    img.save(thumb_path, "JPEG", quality=85)

    return filename, thumb_filename


def delete_photo_files(filename: str, thumbnail_filename: str):
    for path in [
        os.path.join(PHOTOS_DIR, filename),
        os.path.join(THUMBNAILS_DIR, thumbnail_filename),
    ]:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
