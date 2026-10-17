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

    def do_GET(self):
        if self.path.split("?")[0] == "/notes":
            # Private: only from this Mac. Requests through the tunnel carry a Cf-Connecting-Ip header.
            if self.headers.get("Cf-Connecting-Ip") or self.client_address[0] not in ("127.0.0.1", "::1"):
                self.send_error(404)
                return
            try:
                text = open(NOTES, encoding="utf-8").read()
            except FileNotFoundError:
                text = ""
            import html, re
            blocks = [b for b in re.split(r"\n(?=## )", text) if b.startswith("## ")]
            cards = []
            for b in reversed(blocks):
                head, _, rest = b.partition("\n")
                meta = re.findall(r"^- (\w+): (.*)$", rest, re.M)
                body = re.sub(r"^- \w+: .*$", "", rest, flags=re.M).strip()
                cards.append("<article><h2>%s</h2><p class=m>%s</p><pre>%s</pre></article>" % (
                    html.escape(head[3:]), " · ".join("%s: %s" % (html.escape(k), html.escape(v)) for k, v in meta), html.escape(body)))
            try:
                import subprocess
                link = subprocess.run(["/bin/sh", os.path.join(ROOT, "tunnel-url.sh")], capture_output=True, text=True, timeout=5).stdout.strip()
            except Exception:
                link = ""
            linkhtml = ("<p class=l>Current link to send V and R: <a href='%s'>%s</a></p>" % (html.escape(link), html.escape(link))) if link else "<p class=l>Tunnel link not available right now.</p>"
            page = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                    "<title>Notes from V and R</title><style>body{font:16px/1.5 -apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1b1a17}"
                    "h1{font-size:28px}article{border:1px solid #ddd;border-radius:12px;padding:16px 18px;margin:14px 0;background:#fff}"
                    "h2{font-size:17px;margin:0 0 4px}.m{color:#666;font-size:13px;margin:0 0 10px}pre{white-space:pre-wrap;font:inherit;margin:0}"
                    ".e{color:#666}.l{background:#fff4c2;border-radius:10px;padding:12px 14px;word-break:break-all}</style><h1>Notes from V and R</h1>%s<p class=e>%d note%s · newest first · also saved in notes.md</p>%s") % (
                    linkhtml, len(cards), "" if len(cards) == 1 else "s", "".join(cards) or "<p class=e>Nothing yet.</p>")
            out = page.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            return
        super().do_GET()

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
