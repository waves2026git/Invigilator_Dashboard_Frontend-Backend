"""
Recording upload and verification routes.
Receives recordings from pi-client, stores in main backend answers collection.
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from bson import ObjectId

from app.config import settings
from app.config.logging_config import get_logger
from app.database import get_db
from app.utils.timezone import now_ist

router = APIRouter(prefix="/api/recordings", tags=["recordings"])
logger = get_logger("app.api.recordings")

# Local storage for audio files (shared with main backend)
AUDIO_DIR = os.environ.get("AUDIO_DIR", "./storage/audio")


@router.post("/{assignment_id}/{question_num}")
async def upload_recording(
    assignment_id: str,
    question_num: int,
    file: UploadFile = File(...),
):
    """
    Upload a single recording from pi-client.
    Saves to local storage and creates answer doc in MongoDB.
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

    # Save to storage
    exam_id = assignment["exam_id"]
    student_id = assignment["student_id"]
    filename = f"{assignment['exam_code']}_{student_id}_q{question_num}.wav"
    rel_path = f"answers/{filename}"
    full_path = os.path.join(AUDIO_DIR, rel_path)

    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)

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
