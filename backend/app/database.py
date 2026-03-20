import asyncpg
import os
from app.config import DATABASE_URL, USER1_LOGIN, USER1_PASSWORD, USER2_LOGIN, USER2_PASSWORD
from app.services.auth import hash_password

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    color VARCHAR(50) NOT NULL DEFAULT 'amber',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    thumbnail_filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""


async def init_db():
    p = await get_pool()
    async with p.acquire() as conn:
        await conn.execute(CREATE_TABLES_SQL)
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
