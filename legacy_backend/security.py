import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from database import db

JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 12


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, username: str, role: str, sid: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "sid": sid,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=TOKEN_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response):
    response.delete_cookie("access_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User dinonaktifkan")
        user.pop("password_hash", None)
        user.pop("_id", None)
        user["sid"] = payload.get("sid")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_superadmin(current=Depends(get_current_user)) -> dict:
    if current.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Akses khusus Superadmin")
    return current


async def verify_temp_password(password: str) -> bool:
    setting = await db.settings.find_one({"key": "temp_password"})
    if not setting:
        return False
    return verify_password(password, setting["hash"])
