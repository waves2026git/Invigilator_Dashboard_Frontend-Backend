from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Inbound ───────────────────────────────────────────────────────────────────

class DeviceRegisterRequest(BaseModel):
    device_uuid: str = Field(..., description="Stable UUID generated on first boot")
    device_number: Optional[str] = Field(None, description="Permanent device number like D001")
    device_name: str = Field("Exam Device", max_length=128)
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    software_version: Optional[str] = None
    os_version: Optional[str] = None


class DeviceHeartbeatRequest(BaseModel):
    device_uuid: str
    status: str = "online"
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    timestamp: Optional[datetime] = None


# ── Outbound ──────────────────────────────────────────────────────────────────

class DeviceResponse(BaseModel):
    id: str = Field(..., validation_alias="_id", serialization_alias="id")
    device_uuid: str
    device_number: Optional[str] = None
    device_name: str
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    software_version: Optional[str] = None
    os_version: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Assignment info (populated by list endpoint)
    assignment: Optional[dict] = None  # {exam_name, student_name, download_status, exam_started_at, duration_minutes}

    model_config = {"populate_by_name": True, "by_alias": False}


class RegisterResponse(BaseModel):
    registered: bool
    device_uuid: str
    message: str


class HeartbeatResponse(BaseModel):
    acknowledged: bool
    device_uuid: str
