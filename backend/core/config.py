import os
import sys

_ENV = os.getenv("ENVIRONMENT", "development").lower()
_IS_PROD = _ENV in ("production", "prod")


class Settings:
    APP_NAME: str = "PDFTools"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production-please")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB: str = os.getenv("MONGODB_DB", "pdftools")

    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    RENDER_EXTERNAL_URL: str = os.getenv("RENDER_EXTERNAL_URL", "")

    # Brevo (transactional email) — used for password reset emails.
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    BREVO_SENDER_EMAIL: str = os.getenv("BREVO_SENDER_EMAIL", "")
    BREVO_SENDER_NAME: str = os.getenv("BREVO_SENDER_NAME", "PDFTools")
    PASSWORD_RESET_EXPIRE_MINUTES: int = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))

    # Default to the safe choice; only relax when explicitly told to (local dev).
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "true").lower() == "true"
    # Frontend (Vercel) and backend (Render) live on different domains, so cookies
    # must be SameSite=None (with Secure=true) to be sent on cross-site requests.
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "none")

    # Hard upload ceiling regardless of plan — protects against reading huge
    # bodies into memory before the plan-based size check even runs.
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(250 * 1024 * 1024)))  # 250 MB


settings = Settings()

if _IS_PROD:
    problems = []
    if settings.SECRET_KEY == "change-this-in-production-please":
        problems.append("SECRET_KEY is still the default placeholder value.")
    if len(settings.SECRET_KEY) < 32:
        problems.append("SECRET_KEY is too short (use at least 32 random characters).")
    if not settings.COOKIE_SECURE:
        problems.append("COOKIE_SECURE is false in production.")
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        problems.append("RAZORPAY_WEBHOOK_SECRET is not set — webhook signature checks will be skipped.")
    if problems:
        msg = "Refusing to start in production with insecure configuration:\n- " + "\n- ".join(problems)
        print(f"❌ {msg}", file=sys.stderr)
        raise SystemExit(msg)

    # Non-fatal: password reset emails just won't send if this is missing,
    # rather than the whole app being unusable, so this is a warning not a hard fail.
    if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
        print("⚠️  BREVO_API_KEY / BREVO_SENDER_EMAIL not set — password reset emails will not be sent.", file=sys.stderr)
