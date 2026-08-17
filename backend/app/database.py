from pymongo import MongoClient, ASCENDING, DESCENDING
from .config import settings

client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
db = client[settings.mongodb_db]


def ensure_indexes() -> None:
    db.complaints.create_index([("complaint_number", ASCENDING)], unique=True)
    db.complaints.create_index([("status", ASCENDING), ("priority", ASCENDING), ("created_at", DESCENDING)])
    db.complaints.create_index([("duplicate_of", ASCENDING)])
    db.callers.create_index([("phone", ASCENDING)], unique=True)
    db.sms_outbox.create_index([("created_at", DESCENDING)])
    db.users.create_index([("username", ASCENDING)], unique=True)
