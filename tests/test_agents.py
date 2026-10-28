"""Other agents than Claude: the server builds their command line and reads their progress.
Fake codex and opencode on the PATH record what they get and print events like the real ones."""
import json, os, stat, subprocess, sys

from playwright.sync_api import expect

from conftest import A1, SRC, Server

FAKE = '''#!{py} -I
import json, os, pathlib, sys
sys.stdin.read()  # like codex exec: with stdin open, it waits for more of the prompt
pathlib.Path("argv.json").write_text(json.dumps(sys.argv[1:]))
print(json.dumps({event}), flush=True)
out = pathlib.Path(os.environ["OUT"])
out.mkdir(exist_ok=True)
(out / "a1.json").write_text(json.dumps({{"status": "done", "reply": "Ok"}}))
'''
EVENTS = {
    "codex": {"type": "item.completed", "item": {"type": "agent_message", "text": "Changing the title"}},
    "opencode": {"type": "text", "part": {"type": "text", "text": "Changing the title"}},
}


def run_with(tmp_path, page, name):
    bin = tmp_path / "bin"
    bin.mkdir()
    f = bin / name
    f.write_text(FAKE.format(py=sys.executable, event=EVENTS[name]))
    f.chmod(f.stat().st_mode | stat.S_IEXEC)
    s = Server(tmp_path, SRC / "review.py", agent=False, extra=["--agent", name])
    s.stop()  # again, with the fake agent on the PATH
    s.env = dict(os.environ, PATH=f"{bin}:{os.environ['PATH']}", OUT=str(s.work / "outcomes"))
    s.stdin = subprocess.PIPE  # a server started by a program that never closes its input
    s.start()
    try:
        s.comments([A1])
        page.goto(s.url)
        page.locator("#rv-run").click()
        expect(page.locator("#rv-job")).to_contain_text("Done", timeout=10000)
        return json.loads((s.report / "argv.json").read_text()), (s.work / "agent.log").read_text()
    finally:
        s.stop()


def test_codex(tmp_path, page):
    argv, log = run_with(tmp_path, page, "codex")
    assert argv[:2] == ["exec", "--json"] and "workspace-write" in argv and "Write it better" not in argv[-1]
    assert "a1" in argv[-1] and "Changing the title" in log


def test_opencode(tmp_path, page):
    argv, log = run_with(tmp_path, page, "opencode")
    assert argv[:3] == ["run", "--format", "json"] and "a1" in argv[-1]
