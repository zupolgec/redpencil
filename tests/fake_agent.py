"""Fake agent for the tests: runs the script in <work dir>/script.json.
Gets the prompt as last argument and saves it to prompt.txt; script file paths are
relative to the folder it runs in, outcomes go to REVIEW_WORKDIR. Steps:
{"wait": s}, {"replace": [file, old, new]}, {"outcome": [id, status, reply]},
{"write": [file, text]}, {"exit": code}."""
import json, os, pathlib, sys, time

here = pathlib.Path.cwd()
work = pathlib.Path(os.environ.get("REVIEW_WORKDIR", here))
(work / "prompt.txt").write_text(sys.argv[-1])
with (work / "runs.txt").open("a") as f:  # one line per run
    f.write("run\n")
for step in json.loads((work / "script.json").read_text()):
    (k, v), = step.items()
    print(json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": f"{k} {v}"}]}}), flush=True)
    if k == "wait":
        time.sleep(v)
    elif k == "replace":
        f = here / v[0]
        f.write_text(f.read_text().replace(v[1], v[2]))
    elif k == "write":
        (here / v[0]).parent.mkdir(parents=True, exist_ok=True)
        (here / v[0]).write_text(v[1])
    elif k == "outcome":
        d = work / "outcomes"
        d.mkdir(exist_ok=True)
        (d / f"{v[0]}.json").write_text(json.dumps({"status": v[1], "reply": v[2]}, ensure_ascii=False))
    elif k == "exit":
        sys.exit(v)
