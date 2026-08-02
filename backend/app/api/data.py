"""
Data routes — list students and exams from shared MongoDB.
Used by invigilator dashboard for assignment.
"""

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel

from app.config.logging_config import get_logger
from app.database import get_db
from app.auth import get_current_invigilator
from app.utils.timezone import now_ist

router = APIRouter(prefix="/api/data", tags=["data"])
logger = get_logger("app.api.data")


def safe_object_id(id_str: str, name: str = "ID") -> ObjectId:
    """Convert string to ObjectId, raise 400 if invalid."""
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"Invalid {name} format")


class ExamStatusUpdate(BaseModel):
    status: str  # "active" or "inactive"


@router.get("/students")
async def list_students(_: str = Depends(get_current_invigilator)):
    """List all students for assignment selection."""
    db = get_db()
    students = await db.students.find({}).sort("name", 1).to_list(500)
    return [{
        "_id": str(s["_id"]),
        "name": s.get("name", ""),
        "student_id": s.get("student_id"),
        "dob": s.get("dob"),
    } for s in students]


@router.get("/exams")
async def list_exams(_: str = Depends(get_current_invigilator)):
    """List active exams for assignment selection."""
    db = get_db()
    exams = await db.exams.find({"status": "active"}).sort("exam_name", 1).to_list(100)
    return [{
        "_id": str(e["_id"]),
        "exam_name": e.get("exam_name", ""),
        "exam_code": e.get("exam_code"),
        "class_id": e.get("class_id"),
        "date": e.get("date"),
        "duration_minutes": e.get("duration_minutes"),
        "question_count": len(e.get("questions", [])),
        "status": e.get("status"),
    } for e in exams]


@router.get("/exams/all")
async def list_all_exams(_: str = Depends(get_current_invigilator)):
    """List all exams (active + inactive) for management."""
    db = get_db()
    exams = await db.exams.find({}).sort("exam_name", 1).to_list(100)
    return [{
        "_id": str(e["_id"]),
        "exam_name": e.get("exam_name", ""),
        "exam_code": e.get("exam_code"),
        "class_id": e.get("class_id"),
        "date": e.get("date"),
        "duration_minutes": e.get("duration_minutes"),
        "question_count": len(e.get("questions", [])),
        "status": e.get("status", "inactive"),
    } for e in exams]


@router.patch("/exams/{exam_id}/status")
async def update_exam_status(
    exam_id: str,
    body: ExamStatusUpdate,
    _: str = Depends(get_current_invigilator)
):
    """Start or close an exam. Invigilator can: standby→active, active→closed."""
    if body.status not in ("active", "closed"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'closed'")
    
    db = get_db()
    oid = safe_object_id(exam_id, "exam_id")
    exam = await db.exams.find_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    current = exam.get("status")
    
    # Validate transitions — allow starting from standby (normal flow) or
    if body.status == "active" and current not in ("standby", "published"):
        raise HTTPException(status_code=400, detail="Can only start exam when status is 'standby' or 'published'")
    if body.status == "closed" and current != "active":
        raise HTTPException(status_code=400, detail="Can only close exam when status is 'active'")
    
    await db.exams.update_one(
        {"_id": oid},
        {"$set": {"status": body.status, "updated_at": now_ist()}}
    )
    
    # Broadcast to all devices with this exam
    from app.websocket.manager import manager
    assignments = await db.assignments.find({"exam_id": exam_id}).to_list(500)
    for a in assignments:
        await manager.send_to_device(a["device_uuid"], {
            "event": "exam_status",
            "exam_id": exam_id,
            "status": body.status,
        })
    
    logger.info("Exam %s status changed to %s", exam_id, body.status)
    return {"message": f"Exam {body.status}", "exam_id": exam_id, "status": body.status}


@router.get("/exams/{exam_id}/students")
async def get_enrolled_students(
    exam_id: str,
    _: str = Depends(get_current_invigilator)
):
    """Get students enrolled in the exam's class, excluding already assigned."""
    db = get_db()
    
    # Get exam to find class_id
    oid = safe_object_id(exam_id, "exam_id")
    exam = await db.exams.find_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    class_id = exam.get("class_id")
    
    # Get enrollments for this class
    enrollments = await db.enrollments.find({"class_id": class_id}).to_list(500)
    student_ids = [ObjectId(e["student_id"]) for e in enrollments]
    
    # Get already assigned students for this exam (by numeric student_id)
    assignments = await db.assignments.find({"exam_id": exam_id}).to_list(500)
    assigned_student_ids = {a["student_id"] for a in assignments}  # numeric IDs
    
    # Get student details, mark assigned ones
    students = await db.students.find({"_id": {"$in": student_ids}}).to_list(500)
    
    return [{
        "_id": str(s["_id"]),
        "name": s.get("name", ""),
        "student_id": s.get("student_id"),
        "assigned": s.get("student_id") in assigned_student_ids,  # Compare numeric IDs
    } for s in students]
