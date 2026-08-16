import os
import sys
import time
import wave

import numpy as np
import sounddevice as sd
from dotenv import load_dotenv
from faster_whisper import WhisperModel

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RECORDINGS_DIR = os.path.join(BASE_DIR, "recordings")

DEFAULT_SAMPLERATE = 16000
MODEL_SIZE = os.environ.get("STT_MODEL_SIZE", "base")
GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")

load_dotenv(os.path.join(os.path.dirname(BASE_DIR), "backend", ".env"))

_model = None


def get_model():
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def stt_provider() -> str:
    return os.environ.get("STT_PROVIDER", "groq").strip().lower()


def _transcribe_groq(path: str, language: str = None) -> str:
    from groq import Groq

    client = Groq()
    params = {
        "model": GROQ_WHISPER_MODEL,
        "file": open(path, "rb"),
        "response_format": "json",
    }
    if language:
        params["language"] = language
    try:
        result = client.audio.transcriptions.create(**params)
        return (result.text or "").strip()
    finally:
        params["file"].close()


def _transcribe_local(path: str, language: str = None) -> str:
    print(f"  Transcribing {os.path.basename(path)} ...")
    start = time.perf_counter()
    segments, info = get_model().transcribe(
        path,
        language=language,
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    elapsed = (time.perf_counter() - start) * 1000
    print(f"  Transcribed in {elapsed:.0f} ms (language: {info.language})")
    return text


def record_audio(filename: str = None, samplerate: int = DEFAULT_SAMPLERATE) -> str:
    if filename is None:
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        filename = os.path.join(RECORDINGS_DIR, time.strftime("rec_%Y%m%d_%H%M%S.wav"))

    print("  Press Enter to START recording...")
    input()
    print("  Recording... press Enter to STOP.")
    chunks = []

    def callback(indata, frames, time_info, status):
        if status:
            print(f"  [mic] {status}")
        chunks.append(indata.copy())

    stream = sd.InputStream(
        samplerate=samplerate, channels=1, dtype="int16", callback=callback
    )
    stream.start()
    input()
    stream.stop()
    stream.close()

    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(audio.tobytes())

    duration = len(audio) / samplerate
    print(f"  Saved {duration:.1f}s audio -> {filename}")
    return filename


def transcribe_audio_file(path: str, language: str = None) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Audio file not found: {path}")
    if not language:
        language = os.environ.get("STT_LANGUAGE") or None

    if stt_provider() == "groq":
        try:
            print(f"  Transcribing {os.path.basename(path)} via Groq Whisper ...")
            start = time.perf_counter()
            text = _transcribe_groq(path, language)
            elapsed = (time.perf_counter() - start) * 1000
            print(f"  Transcribed in {elapsed:.0f} ms (Groq {GROQ_WHISPER_MODEL})")
            return text
        except Exception as exc:
            print(f"[WARNING] Groq transcription failed ({exc}); falling back to local model.")

    return _transcribe_local(path, language)


def transcribe_from_mic() -> str:
    path = record_audio()
    return transcribe_audio_file(path)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="GovPulse AI Speech-to-Text")
    parser.add_argument(
        "audio_file",
        nargs="?",
        help="Audio file to transcribe (MP3/M4A/WAV/AMR/3GP). Omit to record from microphone.",
    )
    parser.add_argument(
        "--language",
        help="Language hint: en, te, ta, hi, kn, ml ... (default: auto-detect)",
    )
    args = parser.parse_args()

    if args.audio_file:
        text = transcribe_audio_file(args.audio_file, language=args.language)
    else:
        text = transcribe_from_mic()

    print()
    print("=" * 64)
    print("  TRANSCRIPT")
    print("-" * 64)
    print(f"  {text}")
    print("=" * 64)
