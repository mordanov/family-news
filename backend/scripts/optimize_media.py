#!/usr/bin/env python3
"""Optimize existing media files in PHOTOS_DIR.

Resizes oversized images to IMAGE_MAX_DIMENSION and converts them to JPEG.
Transcodes videos to H.264 MP4 and scales down if height > VIDEO_MAX_HEIGHT.
Re-generates thumbnails for processed files.

Usage:
  python scripts/optimize_media.py [--dry-run] [--images-only] [--videos-only]

Environment variables (same as the app):
  PHOTOS_DIR           — directory with media files (default: /app/photos)
  THUMBNAILS_DIR       — thumbnails directory    (default: /app/photos/thumbnails)
  IMAGE_MAX_DIMENSION  — max px on longest side  (default: 1920)
  IMAGE_QUALITY        — JPEG quality 1-95       (default: 85)
  VIDEO_MAX_HEIGHT     — max video height px     (default: 1080)
  VIDEO_CRF            — ffmpeg CRF value        (default: 23)
  VIDEO_PRESET         — ffmpeg preset           (default: fast)
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PHOTOS_DIR = Path(os.getenv("PHOTOS_DIR", "/app/photos"))
THUMBNAILS_DIR = Path(os.getenv("THUMBNAILS_DIR", "/app/photos/thumbnails"))
THUMBNAIL_SIZE = (300, 300)
IMAGE_MAX_DIMENSION = int(os.getenv("IMAGE_MAX_DIMENSION", "1920"))
IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "85"))
VIDEO_MAX_HEIGHT = int(os.getenv("VIDEO_MAX_HEIGHT", "1080"))
VIDEO_CRF = int(os.getenv("VIDEO_CRF", "23"))
VIDEO_PRESET = os.getenv("VIDEO_PRESET", "fast")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}


def _thumb_path(filename: str) -> Path:
    stem = Path(filename).stem
    return THUMBNAILS_DIR / f"thumb_{stem}.jpg"


def optimize_image(path: Path, dry_run: bool) -> bool:
    from PIL import Image, ImageOps

    try:
        img = Image.open(path)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        w, h = img.size

        needs_resize = w > IMAGE_MAX_DIMENSION or h > IMAGE_MAX_DIMENSION
        needs_convert = path.suffix.lower() not in {".jpg", ".jpeg"}

        if not needs_resize and not needs_convert:
            return False

        if needs_resize:
            ratio = min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
            new_w, new_h = int(w * ratio), int(h * ratio)
            print(f"    resize {w}x{h} → {new_w}x{new_h}")
            img = img.resize((new_w, new_h), Image.LANCZOS)

        if dry_run:
            return True

        dst = path.with_suffix(".jpg")
        img.save(dst, "JPEG", quality=IMAGE_QUALITY, optimize=True)
        if dst != path:
            path.unlink()

        # Regenerate thumbnail
        t = dst.with_name(f"thumb_{dst.stem}.jpg")
        thumb = img.copy()
        thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
        thumb.save(THUMBNAILS_DIR / t.name, "JPEG", quality=85)

        return True
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        return False


def _probe(path: Path, stream_key: str) -> str:
    try:
        r = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", f"stream={stream_key}",
                "-of", "csv=p=0",
                str(path),
            ],
            capture_output=True, text=True, timeout=30,
        )
        return r.stdout.strip()
    except Exception:
        return ""


def transcode_video(path: Path, dry_run: bool) -> bool:
    height_str = _probe(path, "height")
    height = int(height_str) if height_str.isdigit() else None
    is_mp4 = path.suffix.lower() == ".mp4"
    needs_scale = height is not None and height > VIDEO_MAX_HEIGHT

    if is_mp4 and not needs_scale:
        codec = _probe(path, "codec_name")
        if codec == "h264":
            print(f"    skip: already H.264 MP4 ({height}p)")
            return False

    dst = path.with_suffix(".mp4")
    scale_info = f" (scale {height}→{VIDEO_MAX_HEIGHT})" if needs_scale else ""
    print(f"    transcode → {dst.name}{scale_info}")

    if dry_run:
        return True

    scale_filter = f"scale=-2:min(ih\\,{VIDEO_MAX_HEIGHT})"
    tmp = path.parent / f".tmp_{path.stem}.mp4"
    try:
        r = subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(path),
                "-vf", scale_filter,
                "-c:v", "libx264",
                "-crf", str(VIDEO_CRF),
                "-preset", VIDEO_PRESET,
                "-c:a", "aac",
                "-movflags", "+faststart",
                str(tmp),
            ],
            capture_output=True, text=True, timeout=3600,
        )
        if r.returncode != 0:
            print(f"    ERROR: {r.stderr[-400:]}", file=sys.stderr)
            if tmp.exists():
                tmp.unlink()
            return False

        tmp.rename(dst)
        if dst != path:
            path.unlink()

        # Regenerate thumbnail
        thumb_path = THUMBNAILS_DIR / f"thumb_{dst.stem}.jpg"
        subprocess.run(
            [
                "ffmpeg", "-y", "-ss", "00:00:01",
                "-i", str(dst),
                "-frames:v", "1",
                "-vf", f"scale={THUMBNAIL_SIZE[0]}:{THUMBNAIL_SIZE[1]}:force_original_aspect_ratio=decrease",
                str(thumb_path),
            ],
            capture_output=True, timeout=60,
        )
        return True
    except Exception as e:
        print(f"    ERROR: {e}", file=sys.stderr)
        if tmp.exists():
            tmp.unlink()
        return False


def main():
    parser = argparse.ArgumentParser(description="Optimize existing media files")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would change without modifying files")
    parser.add_argument("--images-only", action="store_true")
    parser.add_argument("--videos-only", action="store_true")
    args = parser.parse_args()

    if not PHOTOS_DIR.exists():
        print(f"PHOTOS_DIR {PHOTOS_DIR} does not exist", file=sys.stderr)
        sys.exit(1)

    THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        print("DRY RUN — no files will be modified\n")

    changed = skipped = errors = 0

    for path in sorted(PHOTOS_DIR.iterdir()):
        if not path.is_file() or path.name.startswith(".") or path.name.startswith("thumb_"):
            continue

        ext = path.suffix.lower()

        if ext in IMAGE_EXTS and not args.videos_only:
            print(f"Image: {path.name}")
            try:
                if optimize_image(path, args.dry_run):
                    changed += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"  ERROR: {e}", file=sys.stderr)
                errors += 1

        elif ext in VIDEO_EXTS and not args.images_only:
            print(f"Video: {path.name}")
            try:
                if transcode_video(path, args.dry_run):
                    changed += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"  ERROR: {e}", file=sys.stderr)
                errors += 1

        else:
            skipped += 1

    print(f"\nDone: {changed} optimized, {skipped} skipped, {errors} errors")
    if args.dry_run:
        print("(dry run — no files were modified)")


if __name__ == "__main__":
    main()
