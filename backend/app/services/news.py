from asyncpg import Pool
from datetime import datetime
from typing import Optional
from uuid import uuid4
from app.config import DEFAULT_COLOR


def _generate_public_token() -> str:
    return str(uuid4())


async def get_news_list(pool: Pool, page: int = 1, per_page: int = 10):
    offset = (page - 1) * per_page
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM news")
        rows = await conn.fetch(
            """
            SELECT n.id, n.description, n.color, n.created_at, n.updated_at,
                   n.author, n.is_published, n.public_token,
                   array_agg(json_build_object(
                       'id', p.id,
                       'filename', p.filename,
                       'thumbnail_filename', p.thumbnail_filename
                   ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL) as photos
            FROM news n
            LEFT JOIN photos p ON p.news_id = n.id
            GROUP BY n.id
            ORDER BY n.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            per_page, offset
        )
    return total, [dict(r) for r in rows]


async def get_news_by_id(pool: Pool, news_id: int):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT n.id, n.description, n.color, n.created_at, n.updated_at,
                   n.author, n.is_published, n.public_token,
                   array_agg(json_build_object(
                       'id', p.id,
                       'filename', p.filename,
                       'thumbnail_filename', p.thumbnail_filename
                   ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL) as photos
            FROM news n
            LEFT JOIN photos p ON p.news_id = n.id
            WHERE n.id = $1
            GROUP BY n.id
            """,
            news_id
        )
    return dict(row) if row else None


async def create_news(
    pool: Pool,
    description: str,
    author: str,
    color: str = DEFAULT_COLOR,
    created_at: Optional[datetime] = None,
    is_published: bool = False,
) -> int:
    public_token = _generate_public_token() if is_published else None
    async with pool.acquire() as conn:
        if created_at is not None:
            news_id = await conn.fetchval(
                "INSERT INTO news (description, color, author, created_at, updated_at, is_published, public_token) VALUES ($1, $2, $3, $4, $4, $5, $6) RETURNING id",
                description, color, author, created_at, is_published, public_token
            )
        else:
            news_id = await conn.fetchval(
                "INSERT INTO news (description, color, author, is_published, public_token) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                description, color, author, is_published, public_token
            )
    return news_id


async def update_news(
    pool: Pool,
    news_id: int,
    description: str,
    color: str,
    created_at: Optional[datetime] = None,
    is_published: bool = False,
    current_public_token: Optional[str] = None,
) -> bool:
    public_token = current_public_token if is_published else None
    if is_published and not public_token:
        public_token = _generate_public_token()

    async with pool.acquire() as conn:
        if created_at is not None:
            result = await conn.execute(
                "UPDATE news SET description=$1, color=$2, created_at=$3, is_published=$4, public_token=$5, updated_at=NOW() WHERE id=$6",
                description, color, created_at, is_published, public_token, news_id
            )
        else:
            result = await conn.execute(
                "UPDATE news SET description=$1, color=$2, is_published=$3, public_token=$4, updated_at=NOW() WHERE id=$5",
                description, color, is_published, public_token, news_id
            )
    return result == "UPDATE 1"


async def get_news_by_public_token(pool: Pool, public_token: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT n.id, n.description, n.color, n.created_at, n.updated_at,
                   n.author, n.is_published, n.public_token,
                   array_agg(json_build_object(
                       'id', p.id,
                       'filename', p.filename,
                       'thumbnail_filename', p.thumbnail_filename
                   ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL) as photos
            FROM news n
            LEFT JOIN photos p ON p.news_id = n.id
            WHERE n.public_token = $1 AND n.is_published = TRUE
            GROUP BY n.id
            """,
            public_token,
        )
    return dict(row) if row else None


async def rotate_public_token(pool: Pool, news_id: int) -> str:
    new_token = _generate_public_token()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE news SET public_token=$1, updated_at=NOW() WHERE id=$2",
            new_token,
            news_id,
        )
    return new_token


async def delete_news(pool: Pool, news_id: int) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM news WHERE id=$1", news_id)
    return result == "DELETE 1"


async def add_photo(pool: Pool, news_id: int, filename: str, thumbnail_filename: str) -> int:
    async with pool.acquire() as conn:
        photo_id = await conn.fetchval(
            "INSERT INTO photos (news_id, filename, thumbnail_filename) VALUES ($1, $2, $3) RETURNING id",
            news_id, filename, thumbnail_filename
        )
    return photo_id


async def get_photo(pool: Pool, photo_id: int):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM photos WHERE id=$1", photo_id)
    return dict(row) if row else None


async def delete_photo(pool: Pool, photo_id: int) -> dict | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "DELETE FROM photos WHERE id=$1 RETURNING filename, thumbnail_filename",
            photo_id
        )
    return dict(row) if row else None


async def get_news_photos(pool: Pool, news_id: int) -> list:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM photos WHERE news_id=$1", news_id)
    return [dict(r) for r in rows]
