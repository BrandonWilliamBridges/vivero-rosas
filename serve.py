#!/usr/bin/env python3
"""Serves the site from docs/ and saves visitor notes to notes.md.

Run:  python3 serve.py            (listens on 127.0.0.1:8080)
Then: cloudflared tunnel --url http://localhost:8080   (public link)
"""
import json, os, sys, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(ROOT, "docs")
NOTES = os.path.join(ROOT, "notes.md")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DOCS, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (datetime.datetime.now().strftime("%H:%M:%S"), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_POST(self):
        if self.path != "/api/notes":
            self.send_error(404)
            return
        try:
            n = min(int(self.headers.get("Content-Length", "0")), 20000)
            body = json.loads(self.rfile.read(n) or b"{}")
            name = str(body.get("name", "")).strip()[:120]
            text = str(body.get("text", "")).strip()[:5000]
            design = str(body.get("design", "")).strip()[:40]
            lang = str(body.get("lang", "")).strip()[:5]
        except Exception:
            self.send_error(400)
            return
        if not text:
            self.send_error(400)
            return
        when = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        entry = "## %s · %s\n\n- Design: %s\n- Language: %s\n\n%s\n\n" % (
            when, name or "(no name)", design or "start page", lang or "?", text)
        with open(NOTES, "a", encoding="utf-8") as f:
            f.write(entry)
        out = json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    if not os.path.exists(NOTES):
        with open(NOTES, "w", encoding="utf-8") as f:
            f.write("# Notes from Vivero de Rosas\n\n")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("serving %s on http://127.0.0.1:%d  (notes -> %s)" % (DOCS, PORT, NOTES))
    srv.serve_forever()
