import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

from dotenv import load_dotenv
from groq import Groq

from prompt_templates import FEW_SHOT_EXAMPLES, SYSTEM_PROMPT

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

REQUIRED_KEYS = [
    "complaint_id",
    "raw_transcript",
    "detected_language",
    "is_civic_related",
    "department",
    "issue_sub_category",
    "extracted_landmark",
    "urgency_priority",
    "hazard_risk_score",
    "action_required",
    "suggested_sms_reply",
]

VALID_DEPARTMENTS = {
    "Municipal Corporation & Sanitation",
    "Public Works (PWD) & Roads",
    "Water Supply & Sewerage Board",
    "Electricity & Power Distribution",
    "Traffic & Urban Mobility",
}

VALID_PRIORITIES = {"P1-Emergency", "P2-High", "P3-Medium", "P4-Low"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORE_FILE = os.path.join(BASE_DIR, "complaints_store.json")

GROQ_MODEL = "llama-3.3-70b-versatile"
OLLAMA_DEFAULT_MODEL = "llama3.2:latest"
OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434"


def _provider() -> str:
    return os.environ.get("LLM_PROVIDER", "groq").strip().lower()


def _get_model() -> str:
    if _provider() == "ollama":
        return os.environ.get("OLLAMA_MODEL", OLLAMA_DEFAULT_MODEL)
    return GROQ_MODEL


def _get_ollama_base_url() -> str:
    base = os.environ.get("OLLAMA_BASE_URL", OLLAMA_DEFAULT_BASE_URL).strip().rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3].rstrip("/")
    return base


def _call_ollama(model: str, messages: list) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "stream": False,
        "format": "json",
        "keep_alive": -1,
        "options": {
            "num_predict": 250,
            "num_ctx": 2048,
        },
    }
    request = urllib.request.Request(
        f"{_get_ollama_base_url()}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data["message"]["content"]


def _read_store(filename: str = STORE_FILE) -> list:
    if not os.path.exists(filename):
        return []
    try:
        with open(filename, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            data = json.loads(content)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def save_complaint_to_store(record: dict, filename: str = STORE_FILE) -> None:
    data = _read_store(filename)
    data.insert(0, record)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def next_complaint_id() -> str:
    highest = 0
    for record in _read_store():
        match = re.search(r"INC-2026-(\d{4})", str(record.get("complaint_id", "")))
        if match:
            highest = max(highest, int(match.group(1)))
    return f"INC-2026-{highest + 1:04d}"


def _build_messages(transcript_text: str) -> list:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for example in FEW_SHOT_EXAMPLES:
        user_example = example["raw_transcript"]
        assistant_example = json.dumps(example, ensure_ascii=False)
        messages.append({"role": "user", "content": user_example})
        messages.append({"role": "assistant", "content": assistant_example})
    messages.append({"role": "user", "content": transcript_text})
    return messages


def _normalize_record(record: dict, transcript_text: str) -> dict:
    normalized = {}
    for key in REQUIRED_KEYS:
        normalized[key] = record.get(key, "")

    if normalized["department"] not in VALID_DEPARTMENTS:
        normalized["department"] = "Municipal Corporation & Sanitation"

    if normalized["urgency_priority"] not in VALID_PRIORITIES:
        normalized["urgency_priority"] = "P3-Medium"

    try:
        score = int(normalized["hazard_risk_score"])
        normalized["hazard_risk_score"] = max(1, min(100, score))
    except (TypeError, ValueError):
        normalized["hazard_risk_score"] = 50

    try:
        civic = str(record.get("is_civic_related", "true")).strip().lower()
        normalized["is_civic_related"] = civic in ("true", "1", "yes", "y")
    except (TypeError, ValueError):
        normalized["is_civic_related"] = True

    normalized["raw_transcript"] = transcript_text
    return normalized


def process_grievance_text(transcript_text: str) -> dict:
    complaint_id = next_complaint_id()

    try:
        if _provider() == "ollama":
            content = _call_ollama(_get_model(), _build_messages(transcript_text))
        else:
            response = Groq().chat.completions.create(
                model=_get_model(),
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=_build_messages(transcript_text),
            )
            content = response.choices[0].message.content
    except Exception as exc:
        print(f"[ERROR] LLM call failed: {exc}")
        return None

    try:
        record = json.loads(content)
        if not isinstance(record, dict):
            raise ValueError("LLM response is not a JSON object")
    except (json.JSONDecodeError, ValueError, AttributeError, IndexError) as exc:
        print(f"[ERROR] Failed to parse LLM response: {exc}")
        return None

    record = _normalize_record(record, transcript_text)
    record["complaint_id"] = complaint_id
    record["created_at"] = datetime.now(timezone.utc).isoformat()

    if not record["is_civic_related"]:
        return record

    save_complaint_to_store(record)
    return record


def _print_card(record: dict, latency_ms: float) -> None:
    print()
    print("=" * 64)
    print("                GOVPULSE AI - GRIEVANCE CARD")
    print("=" * 64)
    print(f"  Complaint ID        : {record['complaint_id']}")
    print(f"  Department          : {record['department']}")
    print(f"  Category            : {record['issue_sub_category']}")
    print(f"  Priority            : {record['urgency_priority']}")
    print(f"  Risk Score          : {record['hazard_risk_score']}/100")
    print(f"  Landmark            : {record['extracted_landmark']}")
    print(f"  Action Required     : {record['action_required']}")
    print(f"  Suggested SMS Reply : {record['suggested_sms_reply']}")
    print("-" * 64)
    print(f"  Latency             : {latency_ms:.2f} ms")
    print("=" * 64)
    print()


def _print_rejection(elapsed_ms: float) -> None:
    print()
    print("=" * 64)
    print("          NOT A CIVIC SERVICE COMPLAINT")
    print("=" * 64)
    print("  This complaint is not related to the 5 civic")
    print("  services supported by GovPulse AI. Please")
    print("  register complaints about:")
    print("    1. Municipal Corporation & Sanitation")
    print("    2. Public Works (PWD) & Roads")
    print("    3. Water Supply & Sewerage Board")
    print("    4. Electricity & Power Distribution")
    print("    5. Traffic & Urban Mobility")
    print("-" * 64)
    print(f"  Latency: {elapsed_ms:.2f} ms")
    print("=" * 64)
    print()


def _warmup(model: str) -> None:
    try:
        start = time.perf_counter()
        _call_ollama(model, [{"role": "user", "content": "Reply with just: {}"}])
        elapsed = (time.perf_counter() - start) * 1000
        print(f"  Warm-up complete in {elapsed:.0f} ms. Model is ready.")
    except Exception as exc:
        print(f"[WARNING] Warm-up failed (continuing anyway): {exc}")


def interactive_cli() -> None:
    print()
    print("=" * 64)
    print("              GOVPULSE AI TRIAGE ENGINE")
    print(f"       Civic Grievance Triaging with {_get_model()}")
    print("=" * 64)
    print("  Supports English, Tamil, Tanglish, Hindi & code-mixed")
    print("  Type 'exit' anytime to quit.")
    print()

    if _provider() == "ollama":
        _warmup(_get_model())
        print()

    while True:
        try:
            transcript = input("Enter simulated transcript (or 'exit' to quit): > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting GovPulse AI Triage Engine.")
            break

        if not transcript:
            continue
        if transcript.lower() == "exit":
            print("Exiting GovPulse AI Triage Engine.")
            break

        start = time.perf_counter()
        record = process_grievance_text(transcript)
        elapsed_ms = (time.perf_counter() - start) * 1000

        if record is not None:
            if record.get("is_civic_related"):
                _print_card(record, elapsed_ms)
            else:
                _print_rejection(elapsed_ms)
        else:
            print(f"\n[ERROR] Could not process grievance. Latency: {elapsed_ms:.2f} ms\n")


def _process_and_report(transcript: str) -> None:
    start = time.perf_counter()
    record = process_grievance_text(transcript)
    elapsed_ms = (time.perf_counter() - start) * 1000
    if record is not None:
        if record.get("is_civic_related"):
            _print_card(record, elapsed_ms)
        else:
            _print_rejection(elapsed_ms)
    else:
        print(f"\n[ERROR] Could not process grievance. Latency: {elapsed_ms:.2f} ms\n")


def run_stt_once(stt_mode: str, audio_file: str, language: str = None) -> None:
    try:
        from stt.stt_engine import transcribe_audio_file, transcribe_from_mic
    except ImportError:
        print("=" * 64)
        print("[ERROR] Speech-to-text dependencies not installed.")
        print("        Run: pip install -r stt/requirements_stt.txt")
        print("=" * 64)
        sys.exit(1)

    print()
    print("=" * 64)
    print("          GOVPULSE AI - SPEECH TO TEXT")
    print("=" * 64)

    try:
        if stt_mode == "mic":
            transcript = transcribe_from_mic()
        else:
            transcript = transcribe_audio_file(audio_file, language=language)
    except Exception as exc:
        print(f"[ERROR] Audio capture/transcription failed: {exc}")
        sys.exit(1)

    if not transcript:
        print("[ERROR] No speech detected in the audio.")
        sys.exit(1)

    print()
    print(f"  [TRANSCRIPT] {transcript}")
    _process_and_report(transcript)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="GovPulse AI Triage Engine")
    parser.add_argument(
        "--stt",
        action="store_true",
        help="Record from the microphone, transcribe, and process",
    )
    parser.add_argument(
        "--file",
        "--call-file",
        dest="audio_file",
        metavar="AUDIO_FILE",
        help="Transcribe an audio file (call recording: MP3/M4A/WAV) and process",
    )
    parser.add_argument(
        "--language",
        help="STT language hint: en, te, ta, hi, kn, ml ... (default: auto-detect)",
    )
    args = parser.parse_args()

    load_dotenv()
    if _provider() == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            print("=" * 64)
            print("[ERROR] GROQ_API_KEY not found.")
            print("        Add your key to the .env file as: GROQ_API_KEY=your_key")
            print("        or set it as an environment variable.")
            print("=" * 64)
            sys.exit(1)

    if args.stt or args.audio_file:
        run_stt_once("mic" if args.stt else "file", args.audio_file, args.language)
        sys.exit(0)

    interactive_cli()