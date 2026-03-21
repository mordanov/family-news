from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, require_full_access
from app.database import get_pool
from app.services.auth import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    login: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=255)
    role: str = Field(default="read_only")


class UserRoleUpdate(BaseModel):
    role: str


def _format_user(user) -> dict:
    created_at = user["created_at"]
    return {
        "id": user["id"],
        "login": user["login"],
        "role": user["role"],
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else None,
    }


def _validate_role(role: str) -> str:
    normalized = (role or "").strip()
    if normalized not in {"full_access", "read_only"}:
        raise HTTPException(status_code=400, detail="Роль должна быть full_access или read_only")
    return normalized


async def _count_full_access(conn) -> int:
    return await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='full_access'")


@router.get("")
async def list_users(_=Depends(require_full_access)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, login, role, created_at FROM users ORDER BY created_at ASC")
    return [_format_user(r) for r in rows]


@router.post("", status_code=201)
async def create_user(payload: UserCreate, _=Depends(require_full_access)):
    login = payload.login.strip()
    password = payload.password
    role = _validate_role(payload.role)

    if not login:
        raise HTTPException(status_code=400, detail="Логин обязателен")
    if not password:
        raise HTTPException(status_code=400, detail="Пароль обязателен")

    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO users (login, password_hash, role)
                VALUES ($1, $2, $3)
                RETURNING id, login, role, created_at
                """,
                login,
                hash_password(password),
                role,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Пользователь с таким логином уже существует")

    return _format_user(row)


@router.patch("/{user_id}/role")
async def update_user_role(user_id: int, payload: UserRoleUpdate, current_user=Depends(get_current_user), _=Depends(require_full_access)):
    if current_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Нельзя изменить роль текущего пользователя")

    role = _validate_role(payload.role)

    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id, role FROM users WHERE id=$1", user_id)
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if target["role"] == "full_access" and role != "full_access":
            full_access_count = await _count_full_access(conn)
            if full_access_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Должен оставаться хотя бы один пользователь с полным доступом",
                )

        await conn.execute("UPDATE users SET role=$1 WHERE id=$2", role, user_id)
        updated = await conn.fetchrow("SELECT id, login, role, created_at FROM users WHERE id=$1", user_id)

    return _format_user(updated)


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, current_user=Depends(get_current_user), _=Depends(require_full_access)):
    if current_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить текущего пользователя")

    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id, role FROM users WHERE id=$1", user_id)
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if target["role"] == "full_access":
            full_access_count = await _count_full_access(conn)
            if full_access_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Должен оставаться хотя бы один пользователь с полным доступом",
                )

        await conn.execute("DELETE FROM users WHERE id=$1", user_id)



