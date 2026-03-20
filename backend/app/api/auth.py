from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.database import get_pool
from app.services.auth import verify_password, create_access_token, decode_token
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
    return payload


@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE login=$1", form.username)
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token({"sub": user["login"], "user_id": user["id"]})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {"login": current_user["sub"]}
