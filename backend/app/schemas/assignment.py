"""
Assignment schemas for invigilator → device assignment flow.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class QuestionPackage(BaseModel):
    """Single question in assignment package."""
    q_num: int
    type: str  # mcq, short, long
    question_text_mr: Optional[str] = None
    options: Optional[List[str]] = None
    audio_url: Optional[str] = None  # URL to download question audio


class AssignmentCreate(BaseModel):
    """Invigilator creates assignment: device + student + exam."""
    device_number: str = Field(..., description="D001, D002, etc.")
    student_id: str
    exam_id: str


class AssignmentPackage(BaseModel):
    """Full assignment package pushed to device."""
    assignment_id: str
    device_uuid: str
    device_number: str
    student_id: int  # Numeric student ID
    student_name: str
    exam_id: str
    exam_name: str
    exam_code: int
    duration_minutes: int
    instructions: Optional[str] = None
    questions: List[QuestionPackage]
    created_at: datetime


class AssignmentResponse(BaseModel):
    """API response for assignment."""
    id: str = Field(..., alias="_id")
    device_uuid: str
    device_number: str
    student_id: int  # Numeric student ID
    student_name: str
    exam_id: str
    exam_name: str
    exam_code: int
    status: str  # assigned, downloading, ready, in_progress, submitted, completed
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


class AssignmentStatusUpdate(BaseModel):
    """Device updates its assignment status."""
    status: str
