import os
import time
import wave

import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RECORDINGS_DIR = os.path.join(BASE_DIR, "recordings")

DEFAULT_SAMPLERATE = 16000
MODEL_SIZE = os.environ.get("STT_MODEL_SIZE", "small")

_model = None


def get_model():
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


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
    print(f"  Transcribing {os.path.basename(path)} ...")
    start = time.perf_counter()
    segments, info = get_model().transcribe(path, language=language, beam_size=5)
    text = " ".join(s.text.strip() for s in segments).strip()
    elapsed = (time.perf_counter() - start) * 1000
    print(f"  Transcribed in {elapsed:.0f} ms (language: {info.language})")
    return text


def transcribe_from_mic() -> str:
    path = record_audio()
    return transcribe_audio_file(path)


if __name__ == "__main__":
    text = transcribe_from_mic()
    print()
    print("=" * 64)
    print("  TRANSCRIPT")
    print("-" * 64)
    print(f"  {text}")
    print("=" * 64)
