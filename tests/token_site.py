"""A site like Laravel's: every response has a new token ({{token}} in the files)."""
import functools, http.server, sys, uuid


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send_head(self):
        if not self.path.split("?")[0].endswith((".html", "/")):
            return super().send_head()
        f = self.translate_path(self.path)
        f = f + "index.html" if f.endswith("/") else f
        body = open(f).read().replace("{{token}}", uuid.uuid4().hex).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        import io
        return io.BytesIO(body)


http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), functools.partial(H, directory=sys.argv[2])).serve_forever()
