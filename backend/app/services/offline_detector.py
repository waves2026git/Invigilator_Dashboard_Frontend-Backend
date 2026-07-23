"""
Background task: periodically marks devices offline when heartbeat is stale.
Also broadcasts status changes to dashboard WebSocket clients.
"""

import asyncio

from app.config import settings
from app.config.logging_config import get_logger
from app.services.device_service import DeviceService
from app.websocket.manager import manager

logger = get_logger("app.services.offline_detector")


async def offline_detection_loop() -> None:
    logger.info(
        "Offline detector started | threshold=%ds check_interval=%ds",
        settings.offline_threshold_seconds,
        settings.offline_check_interval_seconds,
    )
    while True:
        await asyncio.sleep(settings.offline_check_interval_seconds)
        try:
            svc = DeviceService()
            count = await svc.mark_stale_devices_offline()
            if count:
                await manager.broadcast_dashboard(
                    {"event": "devices_went_offline", "count": count}
                )
        except Exception as e:
            logger.error("Offline detector error: %s", e)
