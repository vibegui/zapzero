"""Serves the radar folder on localhost and stores the cleanup decisions posted by the limpeza page."""
import http.server, json, os, sys
ROOT = sys.argv[1]

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s):
        s.send_header("cache-control", "no-store"); super().end_headers()
    def do_POST(s):
        if s.path != "/decisoes": return s.send_error(404)
        n = int(s.headers.get("content-length", 0))
        if not 0 < n < 1_000_000: return s.send_error(413)
        try:
            body = json.loads(s.rfile.read(n))
            clean = dict(gerado=str(body["gerado"]), arquivar=[int(x) for x in body["arquivar"]], manter=[int(x) for x in body["manter"]])
        except (ValueError, KeyError, TypeError): return s.send_error(400)
        tmp = os.path.join(ROOT, "decisoes.json.tmp")
        with open(tmp, "w") as f: json.dump(clean, f)
        os.replace(tmp, os.path.join(ROOT, "decisoes.json"))
        s.send_response(204); s.end_headers()

http.server.ThreadingHTTPServer(("127.0.0.1", 8810), H).serve_forever()
