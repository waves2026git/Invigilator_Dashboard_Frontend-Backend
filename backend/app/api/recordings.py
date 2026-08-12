"""
Recording upload and verification routes.
Receives recordings from pi-client, stores in main backend answers collection.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from bson import ObjectId

from app.config.logging_config import get_logger
from app.database import get_db
from app.storage import get_storage
from app.utils.timezone import now_ist

router = APIRouter(prefix="/api/recordings", tags=["recordings"])
logger = get_logger("app.api.recordings")


@router.get("/verify")
async def verify_recording_uploaded(exam_code: int, student_id: int, question_num: int):
    """
    Check whether a specific recording is confirmed present in the answers
    collection. Used by pi-client's "clear device data" to decide which local
    files are safe to delete. Local filenames only carry exam_code (the human
    code), so it's resolved to exam_id here before checking answers.
    """
    db = get_db()
    exam = await db.exams.find_one({"exam_code": exam_code})
    if not exam:
        return {"uploaded": False}

    answer = await db.answers.find_one({
        "exam_id": str(exam["_id"]),
        "student_id": student_id,
        "question_id": question_num,
        "audio_path": {"$ne": None},
    })
    return {"uploaded": answer is not None}


# NOTE: Specific routes like /missing and /complete must be declared BEFORE
# the generic /{assignment_id}/{question_num} route below. FastAPI/Starlette
# matches routes in registration order, and {question_num} is a greedy path
# parameter that would otherwise swallow "missing"/"complete" as its value
# and fail int-parsing validation before ever reaching the intended route.

@router.get("/{assignment_id}/missing")
async def get_missing_recordings(assignment_id: str):
    """
    Return list of question numbers that haven't been uploaded yet.
    Used by pi-client during smart submission.
    """
    db = get_db()

    assignment = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    total_questions = [q["q_num"] for q in assignment.get("questions", [])]
    uploaded = set(assignment.get("uploaded_questions", []))
    missing = [q for q in total_questions if q not in uploaded]

    return {
        "assignment_id": assignment_id,
        "total": len(total_questions),
        "uploaded": len(uploaded),
        "missing": missing,
    }


@router.post("/{assignment_id}/complete")
async def mark_submission_complete(assignment_id: str):
    """
    Mark assignment as submitted after all recordings are confirmed.
    """
    db = get_db()

    assignment = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    now = now_ist()
    await db.assignments.update_one(
        {"_id": ObjectId(assignment_id)},
        {"$set": {"status": "submitted", "submitted_at": now, "updated_at": now}}
    )

    logger.info("Assignment %s marked as submitted", assignment_id)

    # Broadcast to dashboard
    from app.websocket.manager import manager
    await manager.broadcast_dashboard({
        "event": "exam_submitted",
        "assignment_id": assignment_id,
        "device_number": assignment.get("device_number"),
        "student_name": assignment.get("student_name"),
    })

    return {"message": "Submission complete", "assignment_id": assignment_id}


@router.post("/{assignment_id}/{question_num}")
async def upload_recording(
    assignment_id: str,
    question_num: int,
    file: UploadFile = File(...),
):
    """
    Upload a single recording from pi-client.
    Saves via the shared storage backend (same one the main exam backend
    uses for question audio) and creates an answer doc in MongoDB, so
    recordings are reachable through the same /audio/{path} route
    regardless of which service originally wrote them.
    """
    db = get_db()

    # Get assignment
    assignment = await db.assignments.find_one({"_id": ObjectId(assignment_id)})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Read file content
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Save via shared storage backend
    exam_id = assignment["exam_id"]
    student_id = assignment["student_id"]
    filename = f"{assignment['exam_code']}_{student_id}_q{question_num}.wav"
    rel_path = f"answers/{filename}"

    storage = get_storage()
    await storage.save(rel_path, content)

    logger.info("Recording saved: %s", rel_path)

    # Create/update answer doc in answers collection (same as main backend)
    now = now_ist()
    answer_doc = {
        "exam_id": exam_id,
        "student_id": student_id,
        "question_id": question_num,  # Main backend expects question_id
        "audio_path": rel_path,
        "status": "pending",  # STT worker will process this
        "raw_transcript_mr": None,
        "clean_transcript_mr": None,
        "stt_confidence": None,
        "score": None,
        "assignment_id": assignment_id,
        "timestamp": now,
    }

    # Upsert - replace if exists
    await db.answers.update_one(
        {"exam_id": exam_id, "student_id": student_id, "question_id": question_num},
        {"$set": answer_doc},
        upsert=True
    )

    # Track in assignment
    await db.assignments.update_one(
        {"_id": ObjectId(assignment_id)},
        {
            "$addToSet": {"uploaded_questions": question_num},
            "$set": {"updated_at": now}
        }
    )

    return {"message": "Recording uploaded", "question_num": question_num}