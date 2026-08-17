"""Exotel India SMS adapter. SMS text must match a DLT-approved template."""
import httpx
from datetime import datetime, timezone
from .database import db
from .config import settings


def send_sms(to: str, body: str) -> bool:
    """Always store an SMS event. Simulation mode sends nothing externally."""
    event = {"to": to, "body": body, "created_at": datetime.now(timezone.utc), "provider": settings.telephony_mode}
    if settings.telephony_mode == "simulation":
        db.sms_outbox.insert_one({**event, "status": "SIMULATED"})
        print(f"[Simulated SMS] To {to}: {body}")
        return True
    if not all([settings.exotel_account_sid, settings.exotel_api_key, settings.exotel_api_token, settings.exotel_phone_number]):
        db.sms_outbox.insert_one({**event, "status": "NOT_CONFIGURED"})
        print(f"[Exotel SMS dry run] To {to}: {body}")
        return False
    payload = {"From": settings.exotel_phone_number, "To": to, "Body": body, "SmsType": "transactional"}
    if settings.exotel_dlt_template_id:
        payload["DltTemplateId"] = settings.exotel_dlt_template_id
    url = f"{settings.exotel_api_base}/v1/Accounts/{settings.exotel_account_sid}/Sms/send.json"
    response = httpx.post(url, data=payload, auth=(settings.exotel_api_key, settings.exotel_api_token), timeout=20)
    response.raise_for_status()
    db.sms_outbox.insert_one({**event, "status": "QUEUED"})
    return True
