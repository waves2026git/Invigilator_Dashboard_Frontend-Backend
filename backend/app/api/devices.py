from fastapi import APIRouter, HTTPException, status

from app.database.session import get_db
from app.config.logging_config import get_logger
from app.schemas.device import (
    DeviceHeartbeatRequest,
    DeviceRegisterRequest,
    DeviceResponse,
    HeartbeatResponse,
    RegisterResponse,
)
from app.services.device_service import DeviceService

router = APIRouter(prefix="/api/devices", tags=["devices"])
logger = get_logger("app.api.devices")


def _service() -> DeviceService:
    return DeviceService()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_200_OK)
async def register_device(payload: DeviceRegisterRequest) -> RegisterResponse:
    svc = _service()
    device = await svc.register(payload)
    return RegisterResponse(
        registered=True,
        device_uuid=device["device_uuid"],
        message="Device registered successfully.",
    )


@router.post("/heartbeat", response_model=HeartbeatResponse, status_code=status.HTTP_200_OK)
async def device_heartbeat(payload: DeviceHeartbeatRequest) -> HeartbeatResponse:
    svc = _service()
    device = await svc.heartbeat(payload)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found. Register first.",
        )
    return HeartbeatResponse(acknowledged=True, device_uuid=device["device_uuid"])


@router.get("", response_model=list[DeviceResponse])
async def list_devices() -> list[DeviceResponse]:
    svc = _service()
    db = get_db()
    devices = await svc.get_all()
    
    # Get active assignments for all devices
    assignments = await db.assignments.find({
        "status": {"$in": ["assigned", "downloading", "ready", "in_progress"]}
    }).to_list(500)
    
    # Filter: only show if exam is published/standby/active
    active_exam_ids = set()
    exam_status_by_id: dict[str, str] = {}
    if assignments:
        exam_ids = list({a["exam_id"] for a in assignments})
        from bson import ObjectId
        exams = await db.exams.find({
            "_id": {"$in": [ObjectId(eid) for eid in exam_ids]},
            "status": {"$in": ["published", "standby", "active"]}
        }).to_list(500)
        active_exam_ids = {str(e["_id"]) for e in exams}
        exam_status_by_id = {str(e["_id"]): e.get("status") for e in exams}
    
    assign_by_uuid = {
        a["device_uuid"]: a 
        for a in assignments 
        if a["exam_id"] in active_exam_ids
    }
    
    result = []
    for d in devices:
        a = assign_by_uuid.get(d["device_uuid"])
        assignment_info = None
        if a:
            assignment_info = {
                "exam_id": a.get("exam_id"),
                "exam_name": a.get("exam_name"),
                "exam_status": exam_status_by_id.get(a.get("exam_id")),
                "student_name": a.get("student_name"),
                "download_status": a.get("download_status", "pending"),
                "exam_started_at": a.get("exam_started_at").isoformat() if a.get("exam_started_at") else None,
                "duration_minutes": a.get("duration_minutes"),
                "status": a.get("status"),
            }
        result.append(DeviceResponse(**{**d, "_id": str(d["_id"]), "assignment": assignment_info}))
    
    return result


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: str) -> DeviceResponse:
    svc = _service()
    device = await svc.get_by_id(device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    return DeviceResponse(**{**device, "_id": str(device["_id"])})
