from fastapi import HTTPException

# Plan definitions — single source of truth
PLAN_LIMITS = {
    "free": {
        "max_file_mb": 5,
        "daily_ops": 5,
        "batch_daily": 3,
        "ocr_page_limit": 3,
        "tools": "basic",  # only non-advanced tools
    },
    "pro": {
        "max_file_mb": 50,
        "daily_ops": 100,
        "batch_daily": None,   # unlimited
        "ocr_page_limit": None,
        "tools": "all",
    },
    "team": {
        "max_file_mb": 200,
        "daily_ops": None,
        "batch_daily": None,
        "ocr_page_limit": None,
        "tools": "all",
    },
    "enterprise": {
        "max_file_mb": None,
        "daily_ops": None,
        "batch_daily": None,
        "ocr_page_limit": None,
        "tools": "all",
    },
}

# Tools restricted to paid plans
PAID_ONLY_TOOLS = {"ocr", "pdf-to-pptx", "pdf-to-excel", "excel-to-pdf", "pptx-to-pdf", "html-to-pdf"}

# Basic tools available on free plan
FREE_TOOLS = {
    "merge", "split", "compress", "rotate", "remove-pages",
    "reorder", "watermark", "protect", "unlock", "extract-text",
    "page-numbers", "pdf-to-jpg", "jpg-to-pdf", "info",
}


def get_plan(user) -> str:
    if not user:
        return "free"
    return user.get("plan", "free")


def get_limits(user) -> dict:
    return PLAN_LIMITS[get_plan(user)]


async def check_file_size(file_bytes: int, user):
    limits = get_limits(user)
    max_mb = limits["max_file_mb"]
    if max_mb is None:
        return
    max_bytes = max_mb * 1024 * 1024
    if file_bytes > max_bytes:
        raise HTTPException(
            413,
            f"File too large. Your plan allows up to {max_mb} MB. "
            f"Upgrade to Pro for up to 50 MB.",
        )


async def check_tool_access(tool_id: str, user):
    plan = get_plan(user)
    if plan == "free" and tool_id in PAID_ONLY_TOOLS:
        raise HTTPException(
            403,
            f"'{tool_id}' is not available on the Free plan. Upgrade to Pro to unlock all tools.",
        )


async def check_and_increment_ops(user, db, tool_id: str = None):
    """Check daily ops quota and increment counter. Guests are not rate-limited per-request
    but tool access is still checked."""
    if not user:
        return  # guests — enforce only via tool access check

    plan = get_plan(user)
    limits = PLAN_LIMITS[plan]
    if limits["daily_ops"] is None:
        # unlimited plan — just increment for stats
        from datetime import date
        today = str(date.today())
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$inc": {"usage_count": 1, f"daily_usage.{today}": 1},
            },
        )
        return

    from datetime import date
    today = str(date.today())
    user_doc = await db.users.find_one({"_id": user["_id"]})
    daily = (user_doc or {}).get("daily_usage", {}).get(today, 0)

    if daily >= limits["daily_ops"]:
        raise HTTPException(
            429,
            f"Daily limit reached ({limits['daily_ops']} operations). "
            f"Resets at midnight IST. Upgrade to Pro for more.",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"usage_count": 1, f"daily_usage.{today}": 1}},
    )
