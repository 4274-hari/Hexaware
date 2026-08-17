from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx
from pymongo import DESCENDING
from bson import ObjectId
from .database import db, ensure_indexes
from .schemas import ComplaintCreate, StatusUpdate, AssignmentUpdate, LoginRequest
from .services import create_complaint, serialize, append_event, triage
from .sms import send_sms
from .config import settings
from .transcription import process_recording, transcribe_file, RECORDINGS_DIR
from .auth import login, current_user, head_only, simulator_only, head_or_simulator, seed_users
from fastapi import Depends
from pathlib import Path
from uuid import uuid4

APPROVED_DEPARTMENTS = {
    "Municipal Corporation & Sanitation", "Public Works (PWD) & Roads",
    "Water Supply & Sewerage Board", "Electricity & Power Distribution",
    "Traffic & Urban Mobility", "Disaster Management",
}

app = FastAPI(title="Citizen Call Intelligence API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    ensure_indexes()
    seed_users()

@app.get("/health")
def health():
    db.command("ping")
    return {"status": "healthy"}

@app.post("/api/auth/login")
def sign_in(payload: LoginRequest): return login(payload.username, payload.password, payload.portal)

@app.post("/api/complaints")
def intake(payload: ComplaintCreate): return create_complaint(payload.model_dump())

@app.post("/api/simulation/calls")
async def simulate_call(caller_phone: str = Form(...), audio: UploadFile = File(...), user=Depends(simulator_only)):
    """Independent demo intake: save uploaded audio, transcribe, then use real triage."""
    if settings.telephony_mode != "simulation": raise HTTPException(409, "Simulation mode is disabled")
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    extension = Path(audio.filename or "recording.wav").suffix or ".wav"
    destination = RECORDINGS_DIR / f"simulation_{uuid4().hex}{extension}"
    with destination.open("wb") as target:
        while chunk := await audio.read(1024 * 1024): target.write(chunk)
    transcript, language = transcribe_file(str(destination))
    return create_complaint({"caller_phone": caller_phone, "transcript": transcript, "recording_url": str(destination), "language": language})

@app.post("/api/simulation/calls/text")
def simulate_text_call(payload: dict, user=Depends(simulator_only)):
    """Direct preset scenario simulation intake."""
    phone = payload.get("caller_phone", "+919876543210")
    transcript = payload.get("transcript", "")
    language = payload.get("language", "en")
    if not transcript.strip(): raise HTTPException(422, "Transcript cannot be empty")
    return create_complaint({"caller_phone": phone, "transcript": transcript.strip(), "language": language, "recording_url": None})

@app.get("/api/simulation/history")
def simulation_history(user=Depends(simulator_only)):
    return [serialize(x) for x in db.complaints.find().sort("created_at", DESCENDING).limit(30)]

@app.get("/api/demo/sms-outbox")
def sms_outbox(phone: str, user=Depends(head_or_simulator)):
    """Return only messages sent to one explicitly supplied mobile number."""
    phone = phone.strip()
    if not phone:
        raise HTTPException(422, "A mobile number is required")
    query = {"to": phone}
    return [serialize(x) for x in db.sms_outbox.find(query).sort("created_at", DESCENDING).limit(100)]

@app.get("/api/simulation/location-request")
def location_request(phone: str, user=Depends(simulator_only)):
    """Return the newest complaint for this phone that is waiting for a location."""
    record = db.complaints.find_one(
        {"caller_phone": phone, "location_status": "NEEDED"},
        sort=[("created_at", DESCENDING)],
    )
    return serialize(record) if record else None

@app.post("/api/simulation/location-replies/{complaint_id}")
def simulate_location_reply(complaint_id: str, location: str = Form(...), user=Depends(simulator_only)):
    """Simulates the citizen replying to the missing-location SMS."""
    record = db.complaints.find_one({"_id": ObjectId(complaint_id)})
    if not record: raise HTTPException(404, "Complaint not found")
    if not location.strip(): raise HTTPException(422, "Location is required")
    if record.get("location_status") != "NEEDED":
        raise HTTPException(409, "This complaint is not waiting for a location reply")
    now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
    db.complaints.update_one({"_id": record["_id"]}, {"$set": {"location_text": location.strip(), "location_status": "CAPTURED", "updated_at": now}, "$push": {"timeline": {"at": now, "actor": "Simulated citizen SMS", "event": "Location received", "note": location.strip()}}})
    send_sms(record["caller_phone"], f"Location saved for complaint {record['complaint_number']}. The department has been updated.")
    return serialize(db.complaints.find_one({"_id": record["_id"]}))

@app.get("/api/complaints")
def complaints(status: str | None = None, department: str | None = None, user=Depends(current_user)):
    if user["role"] == "SIMULATOR": raise HTTPException(403, "Use the simulation portal")
    if user["role"] == "DEPARTMENT": department = user["department"]
    query = {k: v for k, v in {"status": status, "department": department}.items() if v}
    return [serialize(x) for x in db.complaints.find(query).sort("created_at", DESCENDING).limit(300)]

@app.get("/api/complaints/{complaint_id}")
def complaint(complaint_id: str, user=Depends(current_user)):
    record = db.complaints.find_one({"_id": ObjectId(complaint_id)})
    if not record: raise HTTPException(404, "Complaint not found")
    if user["role"] == "DEPARTMENT" and record["department"] != user["department"]: raise HTTPException(403, "Not your department")
    return serialize(record)

@app.patch("/api/complaints/{complaint_id}/assign")
def assign(complaint_id: str, payload: AssignmentUpdate, user=Depends(head_only)):
    record = db.complaints.find_one({"_id": ObjectId(complaint_id)})
    if not record: raise HTTPException(404, "Complaint not found")
    if payload.department not in APPROVED_DEPARTMENTS:
        raise HTTPException(422, "Choose one of the approved departments")
    db.complaints.update_one({"_id": record["_id"]}, {"$set": {"department": payload.department, "assigned_officer": payload.officer_name, "routing_corrected_by": user["name"]}})
    append_event(record, user["name"], "Routing corrected", f"Automatic routing corrected to {payload.department}.")
    return {"ok": True}

@app.patch("/api/complaints/{complaint_id}/status")
def change_status(complaint_id: str, payload: StatusUpdate, user=Depends(current_user)):
    record = db.complaints.find_one({"_id": ObjectId(complaint_id)})
    if not record: raise HTTPException(404, "Complaint not found")
    if user["role"] == "DEPARTMENT" and record["department"] != user["department"]: raise HTTPException(403, "Not your department")
    if payload.status == "RESOLVED":
        root_id = record["_id"] if not record.get("duplicate_of") else ObjectId(record["duplicate_of"])
        all_records = list(db.complaints.find({"$or": [{"_id": root_id}, {"duplicate_of": str(root_id)}]}))
        for linked in all_records:
            db.complaints.update_one({"_id": linked["_id"]}, {"$set": {"status": "RESOLVED"}})
            append_event(linked, payload.officer_name, "Resolved", payload.note)
            send_sms(linked["caller_phone"], f"Your complaint {record['complaint_number']} has been resolved. Thank you for helping improve public services.")
    else:
        db.complaints.update_one({"_id": record["_id"]}, {"$set": {"status": payload.status}})
        append_event(record, payload.officer_name, payload.status.replace("_", " ").title(), payload.note)
    return {"ok": True}

@app.get("/api/analytics/overview")
def overview(user=Depends(head_only)):
    pipeline = [{
        "$group": {
            "_id": None,
            "total": {"$sum": 1},
            "open": {"$sum": {"$cond": [{"$in": ["$status", ["NEW", "ASSIGNED", "IN_PROGRESS"]]}, 1, 0]}},
            "emergency": {"$sum": {"$cond": [{"$eq": ["$priority", "P1_EMERGENCY"]}, 1, 0]}},
            "high": {"$sum": {"$cond": [{"$eq": ["$priority", "P2_HIGH"]}, 1, 0]}},
            "medium": {"$sum": {"$cond": [{"$eq": ["$priority", "P3_MEDIUM"]}, 1, 0]}},
            "low": {"$sum": {"$cond": [{"$eq": ["$priority", "P4_LOW"]}, 1, 0]}},
            "high_hazard": {"$sum": {"$cond": [{"$gte": ["$hazard_risk_score", 70]}, 1, 0]}},
            "duplicates": {"$sum": {"$cond": [{"$ne": ["$duplicate_of", None]}, 1, 0]}},
            "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "RESOLVED"]}, 1, 0]}},
            "avg_hazard": {"$avg": "$hazard_risk_score"},
        }
    }]
    values = list(db.complaints.aggregate(pipeline))
    departments = list(db.complaints.aggregate([{ "$group": {"_id": "$department", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]))
    all_depts = list(APPROVED_DEPARTMENTS)
    dept_map = {d["_id"]: d["count"] for d in departments}
    final_depts = [{"_id": dept, "count": dept_map.get(dept, 0)} for dept in all_depts]
    final_depts.sort(key=lambda x: x["count"], reverse=True)
    summary_data = values[0] if values else {"total":0,"open":0,"emergency":0,"high":0,"medium":0,"low":0,"high_hazard":0,"duplicates":0,"resolved":0,"avg_hazard":0}
    if summary_data.get("_id") is None: summary_data.pop("_id", None)
    return {"summary": summary_data, "by_department": final_depts}

@app.api_route("/exotel/sms", methods=["GET", "POST"])
async def incoming_sms(request: Request):
    """Citizen replies with a location after the automated location request."""
    form = dict(request.query_params) if request.method == "GET" else await request.form()
    phone, location = form.get("From") or form.get("from"), (form.get("Body") or form.get("body") or "").strip()
    if phone and location:
        record = db.complaints.find_one({"caller_phone": phone, "location_status": "NEEDED"}, sort=[("created_at", DESCENDING)])
        if record:
            db.complaints.update_one({"_id": record["_id"]}, {"$set": {"location_text": location, "location_status": "CAPTURED", "updated_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc)}, "$push": {"timeline": {"at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc), "actor": "Citizen SMS", "event": "Location received", "note": location}}})
            send_sms(phone, f"Location saved for complaint {record['complaint_number']}. The department has been updated.")
    return Response("<Response></Response>", media_type="application/xml")

@app.api_route("/exotel/call-start", methods=["GET", "POST"])
async def call_start(request: Request):
    """Exotel PassThru applet callback: store call, then begin call-level recording."""
    form = dict(request.query_params) if request.method == "GET" else await request.form()
    call_sid = form.get("CallSid") or form.get("CallUUID") or form.get("call_sid")
    if not call_sid: raise HTTPException(400, "Missing Exotel CallSid")
    db.calls.update_one({"call_sid": call_sid}, {"$set": {"call_sid": call_sid, "from": form.get("From") or form.get("from", "unknown"), "to": form.get("To") or form.get("to"), "state": "RECORDING"}}, upsert=True)
    if all([settings.exotel_account_sid, settings.exotel_api_key, settings.exotel_api_token]):
        url = f"{settings.exotel_api_base}/v1/Accounts/{settings.exotel_account_sid}/Calls/{call_sid}/recording.json"
        data = {"Action": "START", "RecordingChannels": "dual", "RecordingFormat": "mp3-hq", "Leg1Recording": "True", "StatusCallback": f"{settings.public_base_url}/exotel/recording-status"}
        response = httpx.post(url, data=data, auth=(settings.exotel_api_key, settings.exotel_api_token), timeout=20)
        response.raise_for_status()
    return {"ok": True}

@app.api_route("/exotel/recording-status", methods=["GET", "POST"])
async def recording_status(request: Request, background_tasks: BackgroundTasks):
    form = dict(request.query_params) if request.method == "GET" else await request.form()
    sid = form.get("RecordingSid") or form.get("RecordingUUID") or form.get("recording_sid")
    call_sid = form.get("CallSid") or form.get("CallUUID") or form.get("call_sid")
    call = db.calls.find_one({"call_sid": call_sid}) or {}
    recording_url = form.get("RecordingUrl") or form.get("recording_url") or form.get("Url")
    if not sid or not recording_url: raise HTTPException(400, "Missing Exotel recording identifier or URL")
    db.call_recordings.update_one({"recording_sid": sid}, {"$set": {"recording_sid": sid, "call_sid": call_sid, "from": call.get("from", form.get("From", "unknown")), "recording_url": recording_url, "status": form.get("RecordingStatus") or form.get("status"), "duration": form.get("RecordingDuration") or form.get("duration"), "processing_status": "QUEUED"}}, upsert=True)
    background_tasks.add_task(process_recording, sid)
    return {"ok": True}
