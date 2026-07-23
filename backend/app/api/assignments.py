"""
Assignment API routes.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.config.logging_config import get_logger
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentStatusUpdate,
)
from app.services.assignment_service import AssignmentService
from app.websocket.manager import manager
from app.auth import get_current_invigilator

router = APIRouter(prefix="/api/assignments", tags=["assignments"])
logger = get_logger("app.api.assignments")


class DownloadStatusUpdate(BaseModel):
    download_status: str  # pending, downloading, ready


class ExamStartUpdate(BaseModel):
    exam_started_at: datetime


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_assignment(payload: AssignmentCreate, _: str = Depends(get_current_invigilator)):
    """Invigilator creates assignment: device + student + exam."""
    svc = AssignmentService()
    try:
        assignment = await svc.create_assignment(payload)
        return {
            "message": "Assignment created",
            "assignment_id": str(assignment["_id"]),
            "device_number": assignment["device_number"],
            "status": assignment["status"],
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=list[AssignmentResponse])
async def list_assignments(_: str = Depends(get_current_invigilator)):
    """List all assignments."""
    svc = AssignmentService()
    assignments = await svc.get_all()
    return [AssignmentResponse(**{**a, "_id": str(a["_id"])}) for a in assignments]


@router.get("/device/{device_uuid}")
async def get_device_assignment(device_uuid: str):
    """Get current assignment for a device (used by pi-client on reconnect)."""
    svc = AssignmentService()
    assignment = await svc.get_device_assignment(device_uuid)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active assignment")
    
    # Return full package for device
    return {
        "event": "assignment",
        "package": {
            "assignment_id": str(assignment["_id"]),
            "device_uuid": assignment["device_uuid"],
            "device_number": assignment["device_number"],
            "student_id": assignment["student_id"],
            "student_name": assignment["student_name"],
            "exam_id": assignment["exam_id"],
            "exam_name": assignment["exam_name"],
            "exam_code": assignment["exam_code"],
            "duration_minutes": assignment.get("duration_minutes", 60),
            "instructions": assignment.get("instructions"),
            "questions": assignment.get("questions", []),
            "created_at": assignment["created_at"].isoformat(),
        }
    }


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(assignment_id: str, _: str = Depends(get_current_invigilator)):
    """Get assignment by ID."""
    svc = AssignmentService()
    assignment = await svc.get_by_id(assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return AssignmentResponse(**{**assignment, "_id": str(assignment["_id"])})


@router.patch("/{assignment_id}/status")
async def update_assignment_status(assignment_id: str, payload: AssignmentStatusUpdate):
    """Device updates assignment status."""
    svc = AssignmentService()
    assignment = await svc.update_status(assignment_id, payload.status)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return {"message": "Status updated", "status": payload.status}


@router.patch("/{assignment_id}/download-status")
async def update_download_status(assignment_id: str, payload: DownloadStatusUpdate):
    """Pi-client updates download status."""
    if payload.download_status not in ("pending", "downloading", "ready"):
        raise HTTPException(status_code=400, detail="Invalid download_status")
    
    svc = AssignmentService()
    assignment = await svc.update_download_status(assignment_id, payload.download_status)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    
    # Broadcast to dashboard
    await manager.broadcast_dashboard({
        "event": "download_status",
        "assignment_id": assignment_id,
        "device_number": assignment.get("device_number"),
        "download_status": payload.download_status,
    })
    
    return {"message": "Download status updated", "download_status": payload.download_status}


@router.patch("/{assignment_id}/exam-started")
async def update_exam_started(assignment_id: str, payload: ExamStartUpdate):
    """Pi-client reports exam start time."""
    svc = AssignmentService()
    assignment = await svc.update_exam_started(assignment_id, payload.exam_started_at)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    
    # Broadcast to dashboard
    await manager.broadcast_dashboard({
        "event": "exam_started",
        "assignment_id": assignment_id,
        "device_number": assignment.get("device_number"),
        "student_name": assignment.get("student_name"),
        "exam_started_at": payload.exam_started_at.isoformat(),
        "duration_minutes": assignment.get("duration_minutes"),
    })
    
    return {"message": "Exam start recorded", "exam_started_at": payload.exam_started_at.isoformat()}


@router.delete("/device/{device_uuid}")
async def reset_device_assignment(device_uuid: str, _: str = Depends(get_current_invigilator)):
    """Reset device session — delete its active assignment."""
    svc = AssignmentService()
    deleted = await svc.delete_by_device(device_uuid)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No assignment found")
    
    # Notify device to reset
    await manager.send_to_device(device_uuid, {"event": "reset"})
    
    return {"message": "Device reset", "device_uuid": device_uuid}


@router.post("/device/{device_uuid}/continue")
async def continue_device_session(device_uuid: str, _: str = Depends(get_current_invigilator)):
    """Continue device session — signal device to resume."""
    await manager.send_to_device(device_uuid, {"event": "continue"})
    return {"message": "Continue signal sent", "device_uuid": device_uuid}
