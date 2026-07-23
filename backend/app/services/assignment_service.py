"""
Assignment service — creates and manages device assignments.
Reads from shared MongoDB (exams, students collections from main backend).
"""

from datetime import datetime
from typing import Optional
from bson import ObjectId

from app.config.logging_config import get_logger
from app.database import get_db
from app.schemas.assignment import AssignmentCreate, AssignmentPackage, QuestionPackage
from app.websocket.manager import manager
from app.utils.timezone import now_ist

logger = get_logger("app.services.assignment")


class AssignmentService:
    def __init__(self) -> None:
        self._db = get_db()

    async def create_assignment(self, payload: AssignmentCreate) -> dict:
        """
        Create assignment from invigilator request.
        1. Find device by device_number
        2. Fetch student and exam from shared collections
        3. Build assignment package
        4. Save to assignments collection
        5. Push to device via WebSocket
        """
        # 1. Find device
        device = await self._db.devices.find_one({"device_number": payload.device_number})
        if not device:
            raise ValueError(f"Device {payload.device_number} not found")

        # 2. Fetch student by numeric student_id
        student_id_num = int(payload.student_id)
        student = await self._db.students.find_one({"student_id": student_id_num})
        if not student:
            raise ValueError(f"Student {payload.student_id} not found")

        # 3. Fetch exam
        exam = await self._db.exams.find_one({"_id": ObjectId(payload.exam_id)})
        if not exam:
            raise ValueError(f"Exam {payload.exam_id} not found")

        if exam.get("status") not in ("published", "standby", "active"):
            raise ValueError("Exam must be published, standby, or active")

        # 4. Build assignment document
        now = now_ist()
        questions = []
        for q in exam.get("questions", []):
            audio_url = None
            if q.get("audio_path"):
                audio_url = f"/audio/{q['audio_path']}"
            questions.append(QuestionPackage(
                q_num=q["q_num"],
                type=q["type"],
                question_text_mr=q.get("question_text_mr"),
                options=q.get("options"),
                audio_url=audio_url,
            ))

        assignment_doc = {
            "device_uuid": device["device_uuid"],
            "device_number": payload.device_number,
            "student_id": student_id_num,
            "student_name": student.get("name", "Unknown"),
            "exam_id": payload.exam_id,
            "exam_name": exam.get("exam_name", "Unknown"),
            "exam_code": exam.get("exam_code"),
            "duration_minutes": exam.get("duration_minutes", 60),
            "instructions": exam.get("instructions"),
            "questions": [q.model_dump() for q in questions],
            "status": "assigned",
            "download_status": "pending",
            "exam_started_at": None,
            "created_at": now,
            "updated_at": now,
        }

        # Atomic upsert to prevent race condition
        result = await self._db.assignments.update_one(
            {
                "exam_id": payload.exam_id,
                "student_id": student_id_num,
                "status": {"$nin": ["cancelled"]}
            },
            {"$setOnInsert": assignment_doc},
            upsert=True
        )
        
        if result.matched_count > 0:
            existing = await self._db.assignments.find_one({
                "exam_id": payload.exam_id,
                "student_id": student_id_num,
                "status": {"$nin": ["cancelled"]}
            })
            raise ValueError(f"Student already assigned to device {existing.get('device_number')} for this exam")
        
        assignment_doc["_id"] = result.upserted_id

        # 5. Push to device via WebSocket
        package = AssignmentPackage(
            assignment_id=str(result.upserted_id),
            device_uuid=device["device_uuid"],
            device_number=payload.device_number,
            student_id=student_id_num,
            student_name=student.get("name", "Unknown"),
            exam_id=payload.exam_id,
            exam_name=exam.get("exam_name", "Unknown"),
            exam_code=exam.get("exam_code"),
            duration_minutes=exam.get("duration_minutes", 60),
            instructions=exam.get("instructions"),
            questions=questions,
            created_at=now,
        )

        sent = await manager.send_to_device(device["device_uuid"], {
            "event": "assignment",
            "package": package.model_dump(mode="json"),
        })

        if sent:
            logger.info("Assignment pushed to device | device=%s exam=%s", 
                       payload.device_number, exam.get("exam_name"))
        else:
            logger.warning("Device not connected, assignment saved | device=%s", 
                          payload.device_number)

        return assignment_doc

    async def get_device_assignment(self, device_uuid: str) -> Optional[dict]:
        """Get current active assignment for a device."""
        return await self._db.assignments.find_one({
            "device_uuid": device_uuid,
            "status": {"$in": ["assigned", "downloading", "ready", "in_progress"]}
        })

    async def update_status(self, assignment_id: str, status: str) -> Optional[dict]:
        """Update assignment status."""
        result = await self._db.assignments.find_one_and_update(
            {"_id": ObjectId(assignment_id)},
            {"$set": {"status": status, "updated_at": now_ist()}},
            return_document=True
        )
        if result:
            # Broadcast to dashboard
            await manager.broadcast_dashboard({
                "event": "assignment_status",
                "assignment_id": assignment_id,
                "device_number": result.get("device_number"),
                "status": status,
            })
        return result

    async def get_all(self) -> list[dict]:
        """Get all assignments."""
        cursor = self._db.assignments.find().sort("created_at", -1)
        return await cursor.to_list(length=100)

    async def get_by_id(self, assignment_id: str) -> Optional[dict]:
        """Get assignment by ID."""
        return await self._db.assignments.find_one({"_id": ObjectId(assignment_id)})

    async def update_download_status(self, assignment_id: str, download_status: str) -> Optional[dict]:
        """Update download status."""
        return await self._db.assignments.find_one_and_update(
            {"_id": ObjectId(assignment_id)},
            {"$set": {"download_status": download_status, "updated_at": now_ist()}},
            return_document=True
        )

    async def update_exam_started(self, assignment_id: str, exam_started_at: datetime) -> Optional[dict]:
        """Record when student started exam."""
        return await self._db.assignments.find_one_and_update(
            {"_id": ObjectId(assignment_id)},
            {"$set": {"exam_started_at": exam_started_at, "updated_at": now_ist()}},
            return_document=True
        )

    async def delete_by_device(self, device_uuid: str) -> bool:
        """Delete active assignment for device."""
        result = await self._db.assignments.delete_one({
            "device_uuid": device_uuid,
            "status": {"$in": ["assigned", "downloading", "ready", "in_progress"]}
        })
        return result.deleted_count > 0
