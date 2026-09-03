import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from database import db
from security import (
    hash_password, verify_password, create_access_token, set_auth_cookie,
    clear_auth_cookie, get_current_user, verify_temp_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginInput(BaseModel):
    username: str
    password: str


class TempPasswordInput(BaseModel):
    password: str


def now_iso():
    return datetime.now(timezone.utc).isoformat()


@router.post("/login")
async def login(input: LoginInput, response: Response):
    username = input.username.strip()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="User dinonaktifkan")

    sid = str(uuid.uuid4())
    await db.activity_logs.insert_one({
        "id": sid,
        "user_id": user["id"],
        "name": user["name"],
        "username": user["username"],
        "login_time": now_iso(),
        "logout_time": None,
        "logout_type": None,
    })
    token = create_access_token(user["id"], user["username"], user["role"], sid)
    set_auth_cookie(response, token)
    return {
        "id": user["id"], "name": user["name"], "username": user["username"],
        "role": user["role"], "token": token,
    }


@router.post("/logout")
async def logout(request: Request, response: Response, current=Depends(get_current_user)):
    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}
    logout_type = body.get("type", "manual")
    label = "Logout otomatis (tidak aktif)" if logout_type == "auto" else "Logout"
    sid = current.get("sid")
    if sid:
        await db.activity_logs.update_one(
            {"id": sid, "logout_time": None},
            {"$set": {"logout_time": now_iso(), "logout_type": label}},
        )
    clear_auth_cookie(response)
    return {"success": True}


@router.get("/me")
async def me(current=Depends(get_current_user)):
    return {
        "id": current["id"], "name": current["name"], "username": current["username"],
        "role": current["role"],
    }


@router.post("/verify-temp-password")
async def verify_temp(input: TempPasswordInput, current=Depends(get_current_user)):
    if current.get("role") == "superadmin":
        return {"valid": True}
    valid = await verify_temp_password(input.password)
    if not valid:
        raise HTTPException(status_code=403, detail="Password akses salah")
    return {"valid": True}
