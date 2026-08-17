"""MongoDB-backed staff authentication. Initial accounts are seeded once only."""
import json
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import decode, encode, InvalidTokenError
from .config import settings
from .database import db

bearer = HTTPBearer()

def seed_users() -> None:
    initial = {
        settings.head_username: {"password": settings.head_password, "role": "HEAD", "department": None, "name": "Head Office"},
        settings.department_username: {"password": settings.department_password, "role": "DEPARTMENT", "department": settings.department_default, "name": "Department Officer"},
        settings.simulator_username: {"password": settings.simulator_password, "role": "SIMULATOR", "department": None, "name": "Simulation Operator"},
    }
    if settings.department_accounts_json:
        for username, account in json.loads(settings.department_accounts_json).items(): initial[username] = {**account, "role": "DEPARTMENT"}
    for username, user in initial.items():
        # Demo-only: store passwords as plain text so credentials are easy to inspect/edit in MongoDB.
        db.users.update_one(
            {"username": username},
            {"$set": {"password": user["password"], "role": user["role"], "department": user.get("department"), "name": user.get("name", username), "active": True}, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}, "$unset": {"password_hash": ""}},
            upsert=True,
        )

def login(username: str, password: str, portal: str = "OFFICIAL"):
    user = db.users.find_one({"username": username, "active": True})
    if not user or password != user.get("password"): raise HTTPException(401, "Invalid username or password")
    if portal == "SIMULATION" and user["role"] != "SIMULATOR":
        raise HTTPException(403, "Use a Simulation Operator account for the simulation portal")
    if portal == "OFFICIAL" and user["role"] == "SIMULATOR":
        raise HTTPException(403, "Simulation accounts must sign in through the simulation portal")
    payload = {"sub": user["username"], "role": user["role"], "department": user.get("department"), "name": user["name"], "exp": datetime.now(timezone.utc) + timedelta(hours=8)}
    return {"access_token": encode(payload, settings.jwt_secret, algorithm="HS256"), "token_type": "bearer", "user": {k:v for k,v in payload.items() if k != "exp"}}

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try: return decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except InvalidTokenError: raise HTTPException(401, "Session expired or invalid")

def head_only(user=Depends(current_user)):
    if user["role"] != "HEAD": raise HTTPException(403, "Head access required")
    return user

def simulator_only(user=Depends(current_user)):
    if user["role"] != "SIMULATOR": raise HTTPException(403, "Simulation access required")
    return user

def head_or_simulator(user=Depends(current_user)):
    if user["role"] not in {"HEAD", "SIMULATOR"}:
        raise HTTPException(403, "Head Office or Simulation access required")
    return user
