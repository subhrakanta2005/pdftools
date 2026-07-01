import asyncio
import logging
import os
import time
from pathlib import Path

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("/tmp/pdftools")
FILE_MAX_AGE_SECONDS = 2 * 60 * 60  # 2 hours


async def cleanup_temp_files():
    """Delete temp files older than 2 hours."""
    if not UPLOAD_DIR.exists():
        return
    now = time.time()
    deleted = 0
    for f in UPLOAD_DIR.iterdir():
        try:
            if f.is_file() and (now - f.stat().st_mtime) > FILE_MAX_AGE_SECONDS:
                f.unlink()
                deleted += 1
        except Exception as e:
            logger.warning(f"Could not delete {f}: {e}")
    if deleted:
        logger.info(f"🧹 Cleaned up {deleted} temp files")


async def cleanup_loop():
    """Run cleanup every 30 minutes."""
    while True:
        await asyncio.sleep(30 * 60)
        await cleanup_temp_files()


async def keepalive_loop(url: str, interval: int = 10 * 60):
    """Ping self every 10 minutes to prevent Render cold starts."""
    import httpx
    await asyncio.sleep(60)  # wait for server to fully start
    while True:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, timeout=10)
                logger.info(f"💓 Keep-alive ping → {r.status_code}")
        except Exception as e:
            logger.warning(f"Keep-alive failed: {e}")
        await asyncio.sleep(interval)


def start_background_tasks(app_url: str):
    """Call this from lifespan after DB connects."""
    loop = asyncio.get_event_loop()
    loop.create_task(cleanup_loop())
    if app_url:
        loop.create_task(keepalive_loop(f"{app_url}/health"))
