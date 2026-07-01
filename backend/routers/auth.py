import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import settings
from core.database import get_db
from core.deps import get_current_user
from core.email import send_email
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from models.user import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserLogin,
    UserOut,
    UserRegister,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-process rate limiter for brute-force-prone endpoints. Note: this
# is per-worker, not shared across multiple server processes/instances — fine
# for a single Render web service, but if you scale to multiple instances
# behind a load balancer, swap the storage_uri for a shared Redis backend.
limiter = Limiter(key_func=get_remote_address)

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
@limiter.limit("5/minute")
async def register(request: Request, body: UserRegister, response: Response):
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
@limiter.limit("10/minute")
async def login(request: Request, body: UserLogin, response: Response):
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
async def logout(response: Response, refresh_token: Optional[str] = Cookie(None)):
    # Actually revoke the refresh token server-side, not just clear the
    # cookie — otherwise a copied/leaked refresh token keeps working for up
    # to 7 days after the user thinks they've logged out.
    if refresh_token:
        payload = decode_token(refresh_token)
        db = get_db()
        expires_at = (
            datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
            if payload and "exp" in payload
            else datetime.now(timezone.utc) + timedelta(days=7)
        )
        try:
            await db.token_blacklist.insert_one({
                "token": refresh_token,
                "expires_at": expires_at,
            })
        except Exception:
            pass  # already blacklisted or DB hiccup — cookie clear still happens below

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


# ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})

    # Always return the same generic response regardless of whether the email
    # is registered — otherwise this endpoint becomes an account-enumeration
    # oracle (an attacker learns which emails have accounts).
    generic_response = {
        "detail": "If an account with that email exists, a password reset link has been sent."
    }

    if not user:
        return generic_response

    # Google-only accounts have no password to reset.
    if user.get("provider") == "google" and not user.get("password_hash"):
        return generic_response

    raw_token, token_hash = generate_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES
    )

    # Only one active reset link per user — clear any previous outstanding token.
    await db.password_resets.delete_many({"user_id": user["_id"]})
    await db.password_resets.insert_one(
        {
            "user_id": user["_id"],
            "token_hash": token_hash,
            "expires_at": expires_at,
            "used": False,
        }
    )

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    await send_email(
        to_email=user["email"],
        to_name=user.get("name", ""),
        subject="Reset your PDFTools password",
        html_content=f"""
            <p>Hi {user.get('name', '')},</p>
            <p>We received a request to reset your PDFTools password. This link
            expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.</p>
            <p><a href="{reset_link}">Reset your password</a></p>
            <p>If you didn't request this, you can safely ignore this email —
            your password will not be changed.</p>
        """,
    )

    return generic_response


# ─── RESET PASSWORD ──────────────────────────────────────────────────────────
@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, body: ResetPasswordRequest):
    db = get_db()
    token_hash = hash_reset_token(body.token)
    record = await db.password_resets.find_one({"token_hash": token_hash})

    if not record or record.get("used"):
        raise HTTPException(400, "Invalid or expired reset link")

    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired reset link")

    await db.users.update_one(
        {"_id": record["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    # Mark used immediately — the TTL index eventually deletes this document,
    # but that cleanup runs on a background sweep (not instantly), so without
    # this flag the same link could be replayed again within that window.
    await db.password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True}})

    return {"detail": "Password reset successful. You can now log in with your new password."}


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
