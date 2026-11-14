"""Local speech server for WazobiaVoice, for use with Production One's Voice audition.

Exposes POST /v1/audio/speech on this computer only (127.0.0.1) and returns a WAV.

Setup (from the model card, https://huggingface.co/Axiveri/WazobiaVoice):
  1. Accept the model terms on Hugging Face (the repository is gated) and sign in: `huggingface-cli login`
  2. git clone https://github.com/Ememzyvisuals/wazobiavoice-TTS.git
     cd wazobiavoice-TTS && bash scripts/install.sh      (a plain `pip install .` will fail, per the card)
  3. In that same Python environment run:  python wazobia_server.py [--port 8765] [--device cuda]

LICENCE: the weights are research and non-commercial only. Commercial use needs a licence from the developer.

Request body (JSON). Production One sends: input, voice, speed, and the optional fields below.
  input         text to speak (required)
  language      one of yo, ha, ig, pcm, en (default en)
  voice         path to a 5-10 second reference clip on this computer to clone; empty = the model's default voice
  exaggeration  0.0-1.5 expressiveness (default 0.5)
  cfg_weight    0.0-1.0 (default 0.5)

This script follows the usage on the model card. It has not been run by its author: check the first line it prints.
"""
import argparse
import io
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

LANGUAGES = {"yo", "ha", "ig", "pcm", "en"}
MAX_TEXT = 1200


def clamp(value, low, high, default):
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return default


def load_model(device):
    import torch  # noqa: F401  (fails early with a clear message if the environment is wrong)
    from wazobiavoice_tts.mtl_tts import WazobiaVoiceMultilingualTTS

    return WazobiaVoiceMultilingualTTS.from_pretrained(device)


def make_handler(model):
    import torchaudio as ta

    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, body, content_type="application/json"):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _error(self, status, message):
            self._send(status, json.dumps({"error": message}).encode("utf-8"))

        def do_GET(self):
            if self.path in ("/", "/health", "/v1/models"):
                self._send(200, json.dumps({"status": "ok", "model": "wazobia", "languages": sorted(LANGUAGES)}).encode("utf-8"))
            else:
                self._error(404, "Not found")

        def do_POST(self):
            if self.path != "/v1/audio/speech":
                return self._error(404, "Not found")
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 1_000_000:
                    return self._error(400, "Request body is missing or too large")
                body = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                return self._error(400, "Body must be JSON")
            text = str(body.get("input", "")).strip()
            if not text:
                return self._error(400, "No text to speak")
            if len(text) > MAX_TEXT:
                return self._error(400, "Keep the line under %d characters" % MAX_TEXT)
            language = str(body.get("language") or "en").lower()
            if language not in LANGUAGES:
                return self._error(400, "language must be one of: " + ", ".join(sorted(LANGUAGES)))
            reference = str(body.get("voice") or "").strip() or None
            if reference and not os.path.isfile(reference):
                return self._error(400, "Reference clip not found on this computer: " + reference)
            try:
                wav = model.generate(
                    text,
                    language_id=language,
                    audio_prompt_path=reference,
                    exaggeration=clamp(body.get("exaggeration"), 0.0, 1.5, 0.5),
                    cfg_weight=clamp(body.get("cfg_weight"), 0.0, 1.0, 0.5),
                )
                buffer = io.BytesIO()
                ta.save(buffer, wav.cpu(), model.sr, format="wav")
            except Exception as error:  # report the model's own message to the app
                return self._error(500, "Generation failed: %s" % error)
            self._send(200, buffer.getvalue(), "audio/wav")

        def log_message(self, fmt, *args):
            print("%s - %s" % (self.address_string(), fmt % args))

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--device", default=None, help="cuda or cpu (default: cuda if available)")
    args = parser.parse_args()
    device = args.device
    if device is None:
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
    print("Loading WazobiaVoice on %s (CPU is slow)..." % device)
    model = load_model(device)
    server = HTTPServer(("127.0.0.1", args.port), make_handler(model))
    print("Ready: http://127.0.0.1:%d  (this computer only)" % args.port)
    server.serve_forever()


if __name__ == "__main__":
    main()
