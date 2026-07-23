"""
Device schema — no SQLAlchemy, just Pydantic for MongoDB docs.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from ..utils.timezone import now_ist


class DeviceStatus:
    ONLINE = "online"
    OFFLINE = "offline"
    REGISTERED = "registered"


class Device(BaseModel):
    """MongoDB document schema for devices collection."""
    device_uuid: str
    device_number: Optional[str] = None  # D001, D002, etc. (set by pi-client config)
    device_name: str = "Exam Device"
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    software_version: Optional[str] = None
    os_version: Optional[str] = None
    status: str = DeviceStatus.REGISTERED
    last_seen: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_ist)
    updated_at: datetime = Field(default_factory=now_ist)
