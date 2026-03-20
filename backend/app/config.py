import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://newsfeed:newsfeed123@localhost:5432/newsfeed")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

PHOTOS_DIR = os.getenv("PHOTOS_DIR", "/app/photos")
THUMBNAILS_DIR = os.getenv("THUMBNAILS_DIR", "/app/photos/thumbnails")
THUMBNAIL_SIZE = (300, 300)

USER1_LOGIN = os.getenv("USER1_LOGIN", "admin")
USER1_PASSWORD = os.getenv("USER1_PASSWORD", "admin123")
USER2_LOGIN = os.getenv("USER2_LOGIN", "user")
USER2_PASSWORD = os.getenv("USER2_PASSWORD", "user123")

NEWS_COLORS = [
    {"id": "amber", "label": "Оранжево-жёлтый", "value": "#F59E0B"},
    {"id": "teal", "label": "Бирюзовый", "value": "#006D5B"},
    {"id": "blue", "label": "Синий", "value": "#3B82F6"},
    {"id": "rose", "label": "Розовый", "value": "#F43F5E"},
    {"id": "violet", "label": "Фиолетовый", "value": "#8B5CF6"},
    {"id": "emerald", "label": "Зелёный", "value": "#10B981"},
    {"id": "orange", "label": "Оранжевый", "value": "#F97316"},
    {"id": "sky", "label": "Голубой", "value": "#0EA5E9"},
    {"id": "slate", "label": "Серый", "value": "#64748B"},
    {"id": "lime", "label": "Лаймовый", "value": "#84CC16"},
]
DEFAULT_COLOR = "amber"
