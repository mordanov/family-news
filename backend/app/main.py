from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.database import init_db, close_pool
from app.api.auth import router as auth_router
from app.api.news import router as news_router
from app.config import PHOTOS_DIR, THUMBNAILS_DIR
from app.services.photos import ensure_dirs


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    ensure_dirs()
    yield
    await close_pool()


app = FastAPI(title="Family Newsfeed", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/photos/thumbnails", StaticFiles(directory=THUMBNAILS_DIR, check_dir=False), name="thumbnails")
app.mount("/api/photos", StaticFiles(directory=PHOTOS_DIR, check_dir=False), name="photos")

app.include_router(auth_router)
app.include_router(news_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
