import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse

from ..core.config import settings
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from ..models.user import UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_OPTS = dict(
    httponly=True,
    secure=settings.COOKIE_SECURE,
    samesite=settings.COOKIE_SAMESITE,
)


def _set_tokens(response: Response, user_id: str, email: str):
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, max_age=30 * 60, **COOKIE_OPTS)
    response.set_cookie(
        "refresh_token", refresh, max_age=7 * 24 * 3600, **COOKIE_OPTS
    )
    return access, refresh


def _user_out(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "avatar": user.get("avatar"),
        "provider": user.get("provider", "email"),
        "usage_count": user.get("usage_count", 0),
        "created_at": user["created_at"].isoformat(),
    }


# ─── REGISTER ────────────────────────────────────────────────────────────────
@router.post("/register")
async def register(body: UserRegister, response: Response):
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(400, "Email already registered")

    doc = {
        "name": body.name,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "provider": "email",
        "avatar": None,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)
    _set_tokens(response, user_id, body.email)
    doc["_id"] = result.inserted_id
    return {"user": _user_out(doc)}


# ─── LOGIN ───────────────────────────────────────────────────────────────────
@router.post("/login")
async def login(body: UserLogin, response: Response):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    _set_tokens(response, str(user["_id"]), user["email"])
    return {"user": _user_out(user)}


# ─── LOGOUT ──────────────────────────────────────────────────────────────────
@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"detail": "Logged out"}


# ─── REFRESH ─────────────────────────────────────────────────────────────────
@router.post("/refresh")
async def refresh(response: Response, refresh_token: Optional[str] = Cookie(None)):
    if not refresh_token:
        raise HTTPException(401, "No refresh token")
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")

    db = get_db()
    # Check if token is blacklisted
    blacklisted = await db.token_blacklist.find_one({"token": refresh_token})
    if blacklisted:
        raise HTTPException(401, "Token revoked")

    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")

    # Blacklist old refresh token (rotation)
    await db.token_blacklist.insert_one({
        "token": refresh_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    _set_tokens(response, str(user["_id"]), user["email"])
    return {"detail": "Token refreshed"}


# ─── ME ──────────────────────────────────────────────────────────────────────
@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"user": _user_out(user)}


# ─── GOOGLE OAUTH — REDIRECT ─────────────────────────────────────────────────
@router.get("/google")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(501, "Google OAuth not configured")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")


# ─── GOOGLE OAUTH — CALLBACK ─────────────────────────────────────────────────
@router.get("/google/callback")
async def google_callback(code: str, response: Response):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(501, "Google OAuth not configured")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_res.json()
        if "error" in token_data:
            raise HTTPException(400, token_data.get("error_description", "OAuth error"))

        # Get user info
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        guser = userinfo_res.json()

    db = get_db()
    email = guser["email"]
    existing = await db.users.find_one({"email": email})

    if existing:
        user_id = str(existing["_id"])
        # Update avatar if changed
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"avatar": guser.get("picture"), "name": guser.get("name", existing["name"])}},
        )
    else:
        doc = {
            "name": guser.get("name", ""),
            "email": email,
            "password_hash": None,
            "provider": "google",
            "avatar": guser.get("picture"),
            "google_id": guser.get("id"),
            "usage_count": 0,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(doc)
        user_id = str(result.inserted_id)

    # Set cookies and redirect to frontend
    redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback")
    _set_tokens(redirect, user_id, email)
    return redirect
