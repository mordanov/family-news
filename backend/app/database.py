import asyncio
import os

import asyncpg
from app.config import DATABASE_URL, USER1_LOGIN, USER1_PASSWORD, USER2_LOGIN, USER2_PASSWORD
from app.services.auth import hash_password

pool: asyncpg.Pool | None = None
DB_CONNECT_RETRIES = int(os.getenv("DB_CONNECT_RETRIES", "20"))
DB_CONNECT_RETRY_DELAY_SECONDS = float(os.getenv("DB_CONNECT_RETRY_DELAY_SECONDS", "1.5"))


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        last_error = None
        # Retry DB connection to handle startup races with postgres container.
        for attempt in range(1, DB_CONNECT_RETRIES + 1):
            try:
                pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt == DB_CONNECT_RETRIES:
                    raise
                await asyncio.sleep(DB_CONNECT_RETRY_DELAY_SECONDS)

        if pool is None and last_error is not None:
            raise last_error
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        login VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        color VARCHAR(50) NOT NULL DEFAULT 'amber',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        thumbnail_filename VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
]


async def init_db():
    p = await get_pool()
    async with p.acquire() as conn:
        # asyncpg.execute expects a single statement; run DDL sequentially.
        for statement in CREATE_TABLES_SQL:
            await conn.execute(statement)
        await _seed_users(conn)


async def _seed_users(conn):
    for login, password in [
        (USER1_LOGIN, USER1_PASSWORD),
        (USER2_LOGIN, USER2_PASSWORD),
    ]:
        existing = await conn.fetchrow("SELECT id FROM users WHERE login=$1", login)
        if not existing:
            pw_hash = hash_password(password)
            await conn.execute(
                "INSERT INTO users (login, password_hash) VALUES ($1, $2)",
                login, pw_hash
            )
