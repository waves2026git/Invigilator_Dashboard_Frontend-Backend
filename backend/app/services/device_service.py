from datetime import datetime, timedelta
from typing import Optional

from app.config import settings
from app.config.logging_config import get_logger
from app.database import get_db
from app.models.device import DeviceStatus
from app.schemas.device import DeviceRegisterRequest, DeviceHeartbeatRequest
from app.utils.timezone import now_ist

logger = get_logger("app.services.device")


class DeviceService:
    def __init__(self) -> None:
        self._db = get_db()

    # ── Registration ──────────────────────────────────────────────────────────

    async def register(self, payload: DeviceRegisterRequest) -> dict:
        now = now_ist()
        device = await self._db.devices.find_one({"device_uuid": payload.device_uuid})

        if device is None:
            doc = {
                "device_uuid": payload.device_uuid,
                "device_number": payload.device_number,
                "device_name": payload.device_name,
                "hostname": payload.hostname,
                "mac_address": payload.mac_address,
                "ip_address": payload.ip_address,
                "software_version": payload.software_version,
                "os_version": payload.os_version,
                "status": DeviceStatus.REGISTERED,
                "last_seen": None,
                "created_at": now,
                "updated_at": now,
            }
            result = await self._db.devices.insert_one(doc)
            doc["_id"] = result.inserted_id
            logger.info("New device registered | uuid=%s number=%s", payload.device_uuid, payload.device_number)
            return doc
        else:
            # Re-registration: update mutable fields
            update = {
                "device_name": payload.device_name,
                "hostname": payload.hostname,
                "mac_address": payload.mac_address,
                "ip_address": payload.ip_address,
                "software_version": payload.software_version,
                "os_version": payload.os_version,
                "updated_at": now,
            }
            if payload.device_number:
                update["device_number"] = payload.device_number
            await self._db.devices.update_one(
                {"device_uuid": payload.device_uuid},
                {"$set": update}
            )
            logger.info("Device re-registered | uuid=%s", payload.device_uuid)
            return await self._db.devices.find_one({"device_uuid": payload.device_uuid})

    # ── Heartbeat ─────────────────────────────────────────────────────────────

    async def heartbeat(self, payload: DeviceHeartbeatRequest) -> Optional[dict]:
        device = await self._db.devices.find_one({"device_uuid": payload.device_uuid})
        if device is None:
            logger.warning("Heartbeat from unknown device | uuid=%s", payload.device_uuid)
            return None

        now = now_ist()
        update = {
            "status": DeviceStatus.ONLINE,
            "last_seen": now,
            "updated_at": now,
        }
        if payload.ip_address:
            update["ip_address"] = payload.ip_address
        if payload.hostname:
            update["hostname"] = payload.hostname

        await self._db.devices.update_one(
            {"device_uuid": payload.device_uuid},
            {"$set": update}
        )
        logger.debug("Heartbeat received | uuid=%s ip=%s", payload.device_uuid, payload.ip_address)
        return await self._db.devices.find_one({"device_uuid": payload.device_uuid})

    # ── Queries ───────────────────────────────────────────────────────────────

    async def get_all(self) -> list[dict]:
        cursor = self._db.devices.find().sort("created_at", -1)
        return await cursor.to_list(length=None)

    async def get_by_id(self, device_id: str) -> Optional[dict]:
        from bson import ObjectId
        return await self._db.devices.find_one({"_id": ObjectId(device_id)})

    async def get_by_uuid(self, device_uuid: str) -> Optional[dict]:
        return await self._db.devices.find_one({"device_uuid": device_uuid})

    # ── Offline detection (called by background task) ─────────────────────────

    async def mark_stale_devices_offline(self) -> int:
        """Mark devices offline if last_seen is older than the threshold.
        Returns the number of devices updated.
        """
        cutoff = now_ist() - timedelta(
            seconds=settings.offline_threshold_seconds
        )
        result = await self._db.devices.update_many(
            {
                "status": DeviceStatus.ONLINE,
                "last_seen": {"$lt": cutoff}
            },
            {"$set": {"status": DeviceStatus.OFFLINE, "updated_at": now_ist()}}
        )
        if result.modified_count:
            logger.info("Marked %d device(s) offline (stale heartbeat)", result.modified_count)
        return result.modified_count
