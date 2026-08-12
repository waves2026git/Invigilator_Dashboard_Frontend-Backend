"""
WebSocket connection manager.

Tracks one persistent connection per device_uuid.
Broadcasts device-status events to all connected dashboard clients.
"""

import asyncio
import json
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.config.logging_config import get_logger
from app.models.device import DeviceStatus
from app.utils.timezone import now_ist

logger = get_logger("app.websocket.manager")


class ConnectionManager:
    def __init__(self) -> None:
        # device_uuid → WebSocket (Pi connections)
        self._device_connections: dict[str, WebSocket] = {}
        # Set of dashboard WebSocket connections
        self._dashboard_connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ── Pi device connections ─────────────────────────────────────────────────

    async def connect_device(self, device_uuid: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            old = self._device_connections.get(device_uuid)
            if old is not None:
                try:
                    await old.close(code=1001)
                except Exception:
                    pass
            self._device_connections[device_uuid] = ws
        logger.info("Device WebSocket connected | uuid=%s", device_uuid)
        await self.broadcast_dashboard({"event": "device_connected", "device_uuid": device_uuid})

    async def disconnect_device(self, device_uuid: str) -> None:
        async with self._lock:
            self._device_connections.pop(device_uuid, None)
        logger.info("Device WebSocket disconnected | uuid=%s", device_uuid)

        from app.database import get_db
        await get_db().devices.update_one(
            {"device_uuid": device_uuid},
            {"$set": {"status": DeviceStatus.OFFLINE, "updated_at": now_ist()}},
        )
        await self.broadcast_dashboard({"event": "device_disconnected", "device_uuid": device_uuid})

    async def send_to_device(self, device_uuid: str, message: dict) -> bool:
        ws = self._device_connections.get(device_uuid)
        if ws is None:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception as e:
            logger.warning("Failed to send to device %s: %s", device_uuid, e)
            return False

    def is_device_connected(self, device_uuid: str) -> bool:
        return device_uuid in self._device_connections

    def connected_device_uuids(self) -> list[str]:
        return list(self._device_connections.keys())

    # ── Dashboard connections ─────────────────────────────────────────────────

    async def connect_dashboard(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._dashboard_connections.add(ws)
        logger.info("Dashboard client connected | total=%d", len(self._dashboard_connections))

    async def disconnect_dashboard(self, ws: WebSocket) -> None:
        async with self._lock:
            self._dashboard_connections.discard(ws)
        logger.info("Dashboard client disconnected | total=%d", len(self._dashboard_connections))

    async def broadcast_dashboard(self, message: dict) -> None:
        """Send a JSON message to every connected dashboard client."""
        if not self._dashboard_connections:
            return
        payload = json.dumps({**message, "timestamp": now_ist().isoformat()})
        dead: list[WebSocket] = []
        for ws in list(self._dashboard_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        async with self._lock:
            for ws in dead:
                self._dashboard_connections.discard(ws)


# Singleton — imported everywhere
manager = ConnectionManager()
