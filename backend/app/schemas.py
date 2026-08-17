from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

Priority = Literal["P1_EMERGENCY", "P2_HIGH", "P3_MEDIUM", "P4_LOW"]
Status = Literal["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]


class ComplaintCreate(BaseModel):
    caller_phone: str
    transcript: str
    recording_url: str | None = None
    language: str = "en"
    latitude: float | None = None
    longitude: float | None = None


class StatusUpdate(BaseModel):
    status: Status
    note: str = Field(min_length=2, max_length=800)
    officer_name: str = Field(min_length=2, max_length=120)


class AssignmentUpdate(BaseModel):
    department: str
    officer_name: str | None = None


class ExotelRecordingPayload(BaseModel):
    CallSid: str
    From: str
    RecordingUrl: str
    RecordingSid: str | None = None
    RecordingDuration: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str
    portal: Literal["OFFICIAL", "SIMULATION"] = "OFFICIAL"
