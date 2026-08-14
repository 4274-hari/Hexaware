import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE_DIR)
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
STATIC_DIR = os.path.join(BASE_DIR, "static")

sys.path.insert(0, REPO_ROOT)
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from backend_engine import _read_store, process_grievance_text
from stt.stt_engine import transcribe_audio_file

HOST = "127.0.0.1"
PORT = 8000
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".svg": "image/svg+xml",
}
store_lock = threading.Lock()


class GovPulseHandler(BaseHTTPRequestHandler):
    server_version = "GovPulseAI/1.0"

    def log_message(self, fmt, *args):
        print(f"[server] {self.address_string()} - {fmt % args}")

    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj) -> None:
        self._send(status, "application/json", json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def _send_file(self, name: str, content_type: str) -> None:
        path = os.path.normpath(os.path.join(STATIC_DIR, name))
        if not path.startswith(STATIC_DIR) or not os.path.isfile(path):
            self._json(404, {"error": "Not found"})
            return
        with open(path, "rb") as f:
            self._send(200, content_type, f.read())

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length > 0 else b""

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send_file("index.html", MIME_TYPES[".html"])
            return
        if path.startswith("/static/"):
            name = path[len("/static/"):]
            ext = os.path.splitext(name)[1].lower()
            self._send_file(name, MIME_TYPES.get(ext, "application/octet-stream"))
            return
        if path == "/api/complaints":
            with store_lock:
                records = _read_store()
            self._json(200, {"records": records})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/process":
            try:
                payload = json.loads(self._read_body().decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                self._json(400, {"error": "Invalid JSON body"})
                return
            text = str(payload.get("text") or "").strip()
            if not text:
                self._json(400, {"error": "Text is empty"})
                return
            with store_lock:
                record = process_grievance_text(text)
            if record is None:
                self._json(502, {"error": "LLM call failed. Is Ollama running on localhost:11434?"})
                return
            self._json(200, record)
            return

        if path == "/api/audio":
            audio_bytes = self._read_body()
            if not audio_bytes:
                self._json(400, {"error": "No audio received"})
                return
            tmp_file = os.path.join(tempfile.gettempdir(), "govpulse_audio_upload.wav")
            with open(tmp_file, "wb") as f:
                f.write(audio_bytes)
            try:
                with store_lock:
                    transcript = transcribe_audio_file(tmp_file)
                if not transcript:
                    self._json(400, {"error": "No speech detected in audio"})
                    return
                with store_lock:
                    record = process_grievance_text(transcript)
            except Exception as exc:
                self._json(500, {"error": f"Audio processing failed: {exc}"})
                return
            if record is None:
                self._json(502, {"error": "LLM call failed. Is Ollama running on localhost:11434?"})
                return
            self._json(200, {"transcript": transcript, "record": record})
            return

        self._json(404, {"error": "Not found"})


def main():
    server = ThreadingHTTPServer((HOST, PORT), GovPulseHandler)
    print("=" * 56)
    print("  GOVPULSE AI - WEB FRONTEND")
    print(f"  Serving at  http://{HOST}:{PORT}")
    print("  Press Ctrl+C to stop.")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()