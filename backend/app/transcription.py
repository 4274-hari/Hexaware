"""Recording download + local Whisper transcription worker.

For larger deployments, invoke this from Celery/RQ/SQS rather than FastAPI's
in-process background executor. The database record makes work idempotent.
"""
from pathlib import Path
import httpx
from .config import settings
from .database import db
from .services import create_complaint

RECORDINGS_DIR = Path(__file__).resolve().parents[2] / "data" / "recordings"


def transcribe_file(audio_path: str) -> tuple[str, str]:
    """Uses configured Groq Whisper or local Faster-Whisper for uploaded audio."""
    if settings.stt_provider.lower() == "groq":
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is required when STT_PROVIDER=groq")
        from groq import Groq
        with open(audio_path, "rb") as audio:
            args = {"model": "whisper-large-v3", "file": audio, "response_format": "verbose_json"}
            if settings.stt_language: args["language"] = settings.stt_language
            response = Groq(api_key=settings.groq_api_key).audio.transcriptions.create(**args)
        transcript = (response.text or "").strip()
        if not transcript: raise ValueError("No intelligible speech was detected")
        return transcript, getattr(response, "language", None) or settings.stt_language or "unknown"
    from faster_whisper import WhisperModel
    model = WhisperModel(settings.stt_model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path, language=settings.stt_language or None, vad_filter=True)
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    if not transcript: raise ValueError("No intelligible speech was detected")
    return transcript, info.language


def process_recording(recording_sid: str) -> None:
    call = db.call_recordings.find_one({"recording_sid": recording_sid})
    if not call or call.get("processed_at"):
        return
    try:
        RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
        local_file = RECORDINGS_DIR / f"{recording_sid}.mp3"
        auth = (settings.exotel_api_key, settings.exotel_api_token) if settings.exotel_api_key else None
        recording_url = call["recording_url"]
        with httpx.stream("GET", recording_url, auth=auth, timeout=120) as response:
            response.raise_for_status()
            with local_file.open("wb") as target:
                for chunk in response.iter_bytes(): target.write(chunk)
        transcript, language = transcribe_file(str(local_file))
        complaint = create_complaint({"caller_phone": call.get("from", "unknown"), "transcript": transcript,
                                      "recording_url": call["recording_url"], "language": language})
        db.call_recordings.update_one({"_id": call["_id"]}, {"$set": {"processed_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc), "local_path": str(local_file), "complaint_id": complaint["id"], "transcript": transcript, "processing_status": "COMPLETED"}})
    except Exception as exc:
        db.call_recordings.update_one({"_id": call["_id"]}, {"$set": {"processing_status": "FAILED", "processing_error": str(exc)}})
