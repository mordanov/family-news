from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from app.database import get_pool
from app.services.auth import verify_password, create_access_token, decode_token
from app.config import REMEMBER_ME_EXPIRE_DAYS
import asyncpg

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class Token(BaseModel):
    access_token: str
    token_type: str


async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    login = payload.get("sub")
    if not user_id and not login:
        raise HTTPException(status_code=401, detail="Invalid token")

    pool = await get_pool()
    async with pool.acquire() as conn:
        if user_id:
            user = await conn.fetchrow("SELECT id, login, role FROM users WHERE id=$1", user_id)
        else:
            user = await conn.fetchrow("SELECT id, login, role FROM users WHERE login=$1", login)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {"user_id": user["id"], "sub": user["login"], "role": user["role"]}


async def require_full_access(current_user=Depends(get_current_user)):
    if current_user.get("role") != "full_access":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return current_user


class LoginForm:
    def __init__(
        self,
        username: str = Form(...),
        password: str = Form(...),
        remember_me: bool = Form(False),
    ):
        self.username = username
        self.password = password
        self.remember_me = remember_me


@router.post("/login", response_model=Token)
async def login(form: LoginForm = Depends()):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE login=$1", form.username)
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    expires = timedelta(days=REMEMBER_ME_EXPIRE_DAYS) if form.remember_me else None
    token = create_access_token({"sub": user["login"], "user_id": user["id"], "role": user["role"]}, expires_delta=expires)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {"user_id": current_user["user_id"], "login": current_user["sub"], "role": current_user["role"]}
