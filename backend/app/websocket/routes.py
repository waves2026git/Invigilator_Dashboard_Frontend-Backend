"""
WebSocket route handlers.

/ws/device/{device_uuid}   — Pi client endpoint
/ws/dashboard              — Browser dashboard endpoint
"""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config.logging_config import get_logger
from app.services.device_service import DeviceService
from app.websocket.manager import manager
from app.utils.timezone import now_ist

router = APIRouter(tags=["websocket"])
logger = get_logger("app.websocket.routes")


@router.websocket("/ws/device/{device_uuid}")
async def device_ws_endpoint(device_uuid: str, ws: WebSocket):
    svc = DeviceService()

    # Reject unknown devices
    device = await svc.get_by_uuid(device_uuid)
    if device is None:
        await ws.close(code=4004, reason="Device not registered.")
        logger.warning("WS rejected — unknown device | uuid=%s", device_uuid)
        return

    await manager.connect_device(device_uuid, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"event": "error", "detail": "Invalid JSON"})
                continue

            event = msg.get("event", "")

            if event == "ping":
                await ws.send_json({"event": "pong", "timestamp": now_ist().isoformat()})

            elif event == "heartbeat":
                from app.schemas.device import DeviceHeartbeatRequest
                hb = DeviceHeartbeatRequest(
                    device_uuid=device_uuid,
                    status=msg.get("status", "online"),
                    ip_address=msg.get("ip_address"),
                    hostname=msg.get("hostname"),
                )
                await svc.heartbeat(hb)
                await ws.send_json({"event": "heartbeat_ack", "device_uuid": device_uuid})
                await manager.broadcast_dashboard({
                    "event": "device_heartbeat",
                    "device_uuid": device_uuid,
                    "ip_address": msg.get("ip_address"),
                    "hostname": msg.get("hostname"),
                })
                logger.debug("WS heartbeat | uuid=%s", device_uuid)

            else:
                logger.debug("Unknown WS event '%s' from device %s", event, device_uuid)

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_device(device_uuid)


@router.websocket("/ws/dashboard")
async def dashboard_ws_endpoint(ws: WebSocket):
    await manager.connect_dashboard(ws)
    try:
        while True:
            # Keep the connection alive; dashboard only receives, doesn't send
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect_dashboard(ws)
