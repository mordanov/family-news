from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db, close_pool
from app.api.auth import router as auth_router
from app.api.news import router as news_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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

app.include_router(auth_router)
app.include_router(news_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
