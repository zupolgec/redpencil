import hashlib, json, os, pathlib, shutil, socket, subprocess, sys, time, urllib.request

import pytest
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
SRC = HERE.parent / "src"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def is_free(port):
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def site_port(host):
    """The review server's port for a site, as the extension computes it."""
    port = 4400 + int(hashlib.sha1(host.encode()).hexdigest(), 16) % 1500
    return port + 2 if port in (5060, 5061) else port


def up(url, p):
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except OSError:
            time.sleep(0.05)
    if p.poll() is None:
        p.kill()
        raise RuntimeError("server not answering")
    raise RuntimeError(p.stderr.read().decode())


class Server:
    def __init__(self, base, script, page=None, work=None, extra=(), agent=True, env=None):
        self.env = env
        self.report = base / "report"
        self.work = work or self.report / ".review"  # outside the skill comments live next to the page
        if not self.report.exists():
            shutil.copytree(HERE / "page", self.report)
        self.target = [str(self.report / page if page else self.report)]
        port = free_port()
        self.script = script
        self.url = f"http://127.0.0.1:{port}/"
        self.start([*self.target, "--port", str(port), *extra, *(["--agent"] if agent else [])])

    def start(self, args=None):
        self.args = args = args or self.args
        env = getattr(self, "env", None) or dict(os.environ, REVIEW_AGENT=f"{sys.executable} -I {HERE / 'fake_agent.py'}")
        self.p = subprocess.Popen([sys.executable, "-I", str(self.script), *args], env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        up(self.url + "__status", self.p)

    def comments(self, items=None):
        f = self.work / "comments.json"
        if items is not None:
            f.write_text(json.dumps(items, ensure_ascii=False))
        return json.loads(f.read_text())

    def script_steps(self, steps):
        (self.work / "script.json").write_text(json.dumps(steps, ensure_ascii=False))

    def outcome(self, id, status, reply=None):
        d = self.work / "outcomes"
        d.mkdir(exist_ok=True)
        (d / f"{id}.json").write_text(json.dumps({"status": status, "reply": reply}, ensure_ascii=False))

    def wait(self, *extra):
        """An agent session waiting for comments (review.py --wait)."""
        return subprocess.Popen([sys.executable, "-I", str(self.script), *self.target, *extra, "--wait"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def stop(self):
        for p in [self.p, *getattr(self, "others", [])]:
            p.terminate()
            p.wait()


class Site(Server):
    """A site on its own origin (a plain static server on the source folder) and its review server,
    on the port the extension looks for. With snippet=True the pages load the panel themselves."""
    def __init__(self, base, snippet=False, prepare=None, tokens=False):
        self.report = self.source = base / "site"
        self.work = self.source / ".review"
        shutil.copytree(HERE / "page", self.source)
        while True:
            a = free_port()
            port = site_port(f"127.0.0.1:{a}")
            if is_free(port):
                break
        self.site = f"http://127.0.0.1:{a}/"
        self.url = f"http://127.0.0.1:{port}/"
        if prepare:
            prepare(self.source)
        if snippet:
            tag = f'<script src="{self.url}__review.js"></script>'
            for f in self.source.glob("*.html"):
                f.write_text(f.read_text().replace("</body>", tag + "</body>"))
        serve = [str(HERE / "token_site.py"), str(a), str(self.source)] if tokens else \
            ["-m", "http.server", str(a), "--bind", "127.0.0.1", "--directory", str(self.source)]
        self.others = [subprocess.Popen([sys.executable, "-I", *serve],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)]
        up(self.site, self.others[0])
        self.script = SRC / "review.py"
        self.target = ["--site", self.site, "--source", str(self.source)]
        self.start([*self.target, "--agent"])


@pytest.fixture(scope="session")
def pw():
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(pw):
    b = pw.chromium.launch()
    yield b
    b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    yield pg
    ctx.close()
    assert not pg.errors, pg.errors


@pytest.fixture
def site(tmp_path):
    s = Site(tmp_path, snippet=True)
    yield s
    s.stop()


@pytest.fixture
def server(tmp_path):
    s = Server(tmp_path, SRC / "review.py")
    yield s
    s.stop()


A1 = {"id": "a1", "section": "First section", "element": "p", "selector": "#p1",
      "quote": "first section", "text": "Write it better", "created": "2026-10-28 16:00"}
B2 = {"id": "b2", "section": "Page", "element": "h1", "selector": "#title",
      "quote": "", "text": "Title: write New title", "created": "2026-10-28 16:00"}
C3 = {"id": "c3", "section": "Page", "element": "h1", "selector": "#t2", "page": "/other.html",
      "quote": "", "text": "Mockup title: write New mockup", "created": "2026-10-28 16:00"}
