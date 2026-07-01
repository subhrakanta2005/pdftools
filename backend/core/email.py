import httpx
from .config import settings

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(to_email: str, to_name: str, subject: str, html_content: str) -> bool:
    """Send a transactional email via Brevo's HTTP API.

    Returns True/False and never raises. Callers (e.g. forgot-password) must
    not let email delivery failures change the HTTP response — otherwise an
    attacker could tell whether an email address is registered based on
    whether sending succeeded (a timing/response oracle).
    """
    if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
        print(f"⚠️  Email not sent (Brevo not configured): '{subject}' -> {to_email}")
        return False

    payload = {
        "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(BREVO_API_URL, json=payload, headers=headers)
            if resp.status_code >= 400:
                print(f"❌ Brevo email failed ({resp.status_code}): {resp.text}")
                return False
            return True
    except Exception as e:
        print(f"❌ Brevo email exception: {e}")
        return False
