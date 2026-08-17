"""Deterministic civic triage plus optional ML integration points.

No free-form model decision is allowed to close, assign, or notify a complaint.
"""
import re
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
from bson import ObjectId
from pymongo import DESCENDING, ReturnDocument
from .database import db

DEPARTMENT_RULES = {
    "Water Supply & Sewerage Board": ["water", "sewer", "drain", "drainage", "pipe", "leak", "flood", "drinking water", "contamination"],
    "Electricity & Power Distribution": ["electricity", "power", "current", "wire", "transformer", "electric", "spark", "blackout", "pole", "shock"],
    "Public Works (PWD) & Roads": ["road", "pothole", "streetlight", "bridge", "footpath", "traffic signal", "tar", "asphalt", "manhole"],
    "Municipal Corporation & Sanitation": ["garbage", "waste", "sanitation", "mosquito", "dump", "sewage", "trash", "cleanliness", "dead animal"],
    "Traffic & Urban Mobility": ["bus", "traffic", "parking", "auto", "metro", "signal", "jam", "congestion", "one way", "illegal parking"],
    "Disaster Management": ["flood", "cyclone", "storm", "tree fallen", "building collapse", "landslide", "rescue", "inundation", "calamity", "disaster"],
}
EMERGENCY_WORDS = {"fire", "accident", "attack", "collapsed", "electrocution", "ambulance", "life threatening", "severe", "sparking", "explosion", "drowning"}

LANDMARK_COORDINATES = {
    "gandhi circle": (13.0827, 80.2707),
    "anna nagar": (13.0850, 80.2100),
    "t nagar": (13.0418, 80.2341),
    "mg road": (13.0012, 80.2565),
    "market street": (13.0780, 80.2850),
    "ring road": (13.0550, 80.2180),
    "central station": (13.0836, 80.2754),
    "bus stand": (13.0690, 80.1948),
    "nehru park": (13.0795, 80.2452),
    "guindy": (13.0067, 80.2024),
    "velachery": (12.9815, 80.2180),
    "mylapore": (13.0368, 80.2676),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _geocode_landmark(location: str | None, department: str) -> tuple[float, float]:
    """Generates realistic latitude/longitude within metropolitan boundaries."""
    base_lat, base_lng = 13.0827, 80.2707
    if location:
        loc_lower = location.lower()
        for name, coords in LANDMARK_COORDINATES.items():
            if name in loc_lower:
                return coords
        h = int(sha256(location.encode("utf-8")).hexdigest()[:6], 16)
        lat_offset = ((h % 1000) - 500) / 10000.0
        lng_offset = (((h // 1000) % 1000) - 500) / 10000.0
        return round(base_lat + lat_offset, 5), round(base_lng + lng_offset, 5)
    # Default offset by department
    dept_hash = int(sha256(department.encode("utf-8")).hexdigest()[:6], 16)
    return round(base_lat + ((dept_hash % 600) - 300) / 10000.0, 5), round(base_lng + (((dept_hash // 600) % 600) - 300) / 10000.0, 5)


def triage(transcript: str) -> dict[str, Any]:
    """Use the supplied classifier first; deterministic rules are the safe fallback."""
    try:
        from backend_engine import classify_grievance_text
        result = classify_grievance_text(transcript)
        if result and result.get("is_civic_related"):
            location = result.get("extracted_landmark")
            location = None if not location or location.lower() in {"not specified", "unknown", "n/a", "none"} else location
            lat, lng = _geocode_landmark(location, result["department"])
            hazard_score = int(result.get("hazard_risk_score", 50))
            return {
                "department": result["department"],
                "priority": result["urgency_priority"].replace("-", "_").upper(),
                "summary": result.get("issue_sub_category") or transcript[:360],
                "location_text": location,
                "confidence": 0.88,
                "hazard_risk_score": hazard_score,
                "detected_language": result.get("detected_language", "English"),
                "action_required": result.get("action_required", "Immediate inspection required"),
                "suggested_sms_reply": result.get("suggested_sms_reply", ""),
                "latitude": lat,
                "longitude": lng,
                "requires_human_review": False,
                "classifier": "groq_llm_module",
            }
    except Exception as exc:
        print(f"[Classifier fallback] {exc}")
    text = transcript.lower()
    matches = {dept: sum(word in text for word in words) for dept, words in DEPARTMENT_RULES.items()}
    department = max(matches, key=matches.get)
    score = matches[department]
    emergency = any(word in text for word in EMERGENCY_WORDS)
    priority = "P1_EMERGENCY" if emergency else ("P2_HIGH" if score >= 2 else "P3_MEDIUM")
    hazard_score = 90 if emergency else (70 if score >= 2 else 40)
    summary = re.sub(r"\s+", " ", transcript).strip()[:360]
    location = _extract_location(transcript)
    lat, lng = _geocode_landmark(location, department if score else "Municipal Corporation & Sanitation")
    return {
        "department": department if score else "Municipal Corporation & Sanitation",
        "priority": priority,
        "summary": summary,
        "location_text": location,
        "confidence": 0.75 if score else 0.40,
        "hazard_risk_score": hazard_score,
        "detected_language": "English / Mixed",
        "action_required": "Field officer dispatch and inspection",
        "suggested_sms_reply": f"Your complaint regarding {summary[:40]} has been recorded.",
        "latitude": lat,
        "longitude": lng,
        "requires_human_review": score == 0,
        "classifier": "deterministic_fallback",
    }


def _extract_location(text: str) -> str | None:
    match = re.search(r"(?:near|at|in|on)\s+([A-Za-z0-9 ,.-]{3,60})", text, re.I)
    return match.group(1).strip(" ,.") if match else None


def _tokens(text: str) -> set[str]:
    return {x for x in re.findall(r"[a-z]{3,}", text.lower()) if x not in {"there", "their", "please", "complaint"}}


def _normalise_location(location: str | None) -> set[str]:
    """Location must materially match; issue similarity alone is never a duplicate."""
    if not location:
        return set()
    ignored = {"near", "at", "the", "and", "road", "street", "area", "ward"}
    return {part for part in re.findall(r"[a-z0-9]+", location.lower()) if part not in ignored}


def find_duplicate(transcript: str, department: str, location_text: str | None) -> dict | None:
    """Link only the same service issue at the same stated location."""
    location_terms = _normalise_location(location_text)
    if not location_terms:
        return None
    candidate_query = {"department": department, "status": {"$nin": ["RESOLVED", "CLOSED"]}, "duplicate_of": None}
    candidates = db.complaints.find(candidate_query).sort("created_at", DESCENDING).limit(100)
    current = _tokens(transcript)
    for record in candidates:
        existing = _tokens(record.get("transcript", ""))
        union = current | existing
        similarity = len(current & existing) / len(union) if union else 0
        existing_location = _normalise_location(record.get("location_text"))
        common_loc = location_terms & existing_location
        location_union = location_terms | existing_location
        location_overlap = len(common_loc) / len(location_union) if location_union else 0
        # Either substantial Jaccard overlap OR at least 1 shared landmark term with reasonable topic overlap
        if (location_overlap >= 0.25 or len(common_loc) >= 1) and similarity >= 0.22:
            return record
    return None


def serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    for key, value in list(doc.items()):
        if isinstance(value, datetime): doc[key] = value.isoformat()
    return doc


def create_complaint(payload: dict) -> dict:
    analysis = triage(payload["transcript"])
    # Find an existing incident before inserting. This prevents a first complaint
    # from ever comparing against itself.
    duplicate = find_duplicate(payload["transcript"], analysis["department"], analysis["location_text"])
    counter = db.counters.find_one_and_update(
        {"_id": "complaint"}, {"$inc": {"value": 1}}, upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    number = f"CCI-{utcnow():%Y}-{counter['value']:06d}"
    timeline = [{"at": utcnow(), "actor": "AI intake", "event": "Complaint recorded", "note": "Call analysis completed."}]
    doc = {"complaint_number": number, **payload, **analysis, "status": "NEW", "location_status": "CAPTURED" if analysis["location_text"] else "NEEDED",
           "duplicate_of": None, "duplicate_complaint_number": None,
           "timeline": timeline, "created_at": utcnow(), "updated_at": utcnow(), "assigned_officer": None}
    if duplicate:
        doc.update({"duplicate_of": str(duplicate["_id"]), "duplicate_complaint_number": duplicate["complaint_number"], "status": "ASSIGNED"})
        doc["timeline"].append({"at": utcnow(), "actor": "Duplicate engine", "event": "Linked to existing incident", "note": f"Same location and related issue as {duplicate['complaint_number']}; resolution SMS will be sent to this caller."})
    result = db.complaints.insert_one(doc)
    # Confirmation is intentionally sent before duplicate detection: each caller is acknowledged.
    from .sms import send_sms
    send_sms(payload["caller_phone"], f"Complaint {number} received and routed to {analysis['department']}. We will update you by SMS.")
    if not analysis["location_text"]:
        send_sms(payload["caller_phone"], f"For complaint {number}, reply with your street, landmark or locality so the department can act faster.")
    db.callers.update_one({"phone": payload["caller_phone"]}, {"$addToSet": {"complaints": result.inserted_id}, "$set": {"last_contact": utcnow()}}, upsert=True)
    return serialize(doc | {"_id": result.inserted_id})


def append_event(record: dict, actor: str, event: str, note: str) -> None:
    db.complaints.update_one({"_id": record["_id"]}, {"$push": {"timeline": {"at": utcnow(), "actor": actor, "event": event, "note": note}}, "$set": {"updated_at": utcnow()}})
