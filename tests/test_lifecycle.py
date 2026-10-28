"""The review lives as long as someone uses it: --wait starts it when it isn't there, it stops by itself
when nobody looks at it, and an old one still running is named instead of looking absent."""
import http.server, json, os, signal, subprocess, sys, threading, time

from playwright.sync_api import expect

from conftest import A1, SRC, Server, free_port, up


def stop_pid(work):
    try:
        os.kill(json.loads((work / "server.json").read_text())["pid"], signal.SIGTERM)
    except (OSError, ValueError, KeyError):
        pass


def test_wait_starts_the_review(tmp_path, page):
    s = Server(tmp_path, SRC / "review.py")
    s.stop()
    s.comments([A1])
    port = s.url.rsplit(":", 1)[1].strip("/")
    waiting = s.wait("--port", port)
    try:
        up(s.url + "__status", waiting)
        page.goto(s.url)
        expect(page.locator("#rv-run")).to_have_attribute("aria-label", "Send the open comments to your agent session", timeout=8000)
        page.locator("#rv-run").click()
        out, err = waiting.communicate(timeout=10)
        assert waiting.returncode == 0, err
        assert "Write it better" in out
        page.reload()  # the review stays open after the comments went to the session
        expect(page.locator("#rv-side")).to_be_visible()
    finally:
        waiting.kill()
        stop_pid(s.work)


def test_a_review_nobody_uses_stops(tmp_path):
    s = Server(tmp_path, SRC / "review.py", extra=["--idle", "2"])
    try:
        s.p.wait(timeout=10)  # no page open, no session waiting
    finally:
        s.stop()


def test_an_old_review_is_named(tmp_path):
    s = Server(tmp_path, SRC / "review.py")
    s.stop()
    root = str(s.report)

    class Old(http.server.BaseHTTPRequestHandler):  # what an earlier version answers
        def do_GET(self):
            body = json.dumps({"state": "idle", "root": root}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    port = free_port()
    old = http.server.ThreadingHTTPServer(("127.0.0.1", port), Old)
    threading.Thread(target=old.serve_forever, daemon=True).start()
    (s.work / "server.json").write_text(json.dumps({"url": f"http://127.0.0.1:{port}/", "pid": 4242}))
    try:
        r = subprocess.run([sys.executable, "-I", str(SRC / "review.py"), *s.target, "--port", str(port), "--wait"],
                           capture_output=True, text=True, timeout=20)
        assert r.returncode != 0
        assert "older version" in r.stderr and "4242" in r.stderr
    finally:
        old.shutdown()


def test_server_gone_tells_what_to_do(server, page):
    page.goto(server.url)
    expect(page.locator("#rv-side")).to_be_visible()
    server.stop()
    expect(page.locator("#rv-job")).to_contain_text("Ask your agent to open it again", timeout=15000)
    server.start()
    expect(page.locator("#rv-job")).not_to_contain_text("Ask your agent", timeout=15000)
