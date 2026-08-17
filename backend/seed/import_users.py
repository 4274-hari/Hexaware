"""Run from backend: python seed/import_users.py"""
import json
from pathlib import Path
from pymongo import MongoClient

users = json.loads((Path(__file__).with_name("users.seed.json")).read_text(encoding="utf-8"))
collection = MongoClient("mongodb://localhost:27017")["citizen_call_intelligence"].users
for user in users:
    collection.update_one({"username": user["username"]}, {"$set": user}, upsert=True)
print(f"Imported {len(users)} synthetic users into citizen_call_intelligence.users")
