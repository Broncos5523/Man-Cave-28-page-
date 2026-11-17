"""Collect the seven original browser suites into one shareable staging report.

Called by the one-shot GitHub acceptance workflow, after all independent jobs.
Only test observations are published; no private credentials or TV commands.
"""
import datetime
import json
import os
import pathlib
import re

root = pathlib.Path("_batch-evidence")
out = pathlib.Path("_batch-report")
out.mkdir(exist_ok=True)
groups = {}
board_results = {}
for group in sorted(root.glob("cloudflare-28-*-evidence")):
    name = group.name.removeprefix("cloudflare-28-").removesuffix("-evidence")
    lines = (group / "browser-check.log").read_text(errors="replace").splitlines() if (group / "browser-check.log").exists() else []
    observations = []
    errors = []
    for line in lines:
        m = re.search(r"(BOARD_RENDER_RESULT|PAGE4_RENDER_RESULT|NATIVE_PAGE4_RESULT|BOARD_AUDIT|PASS_ORIGINAL_RENDERER)\s+(\{.*\})", line)
        if m:
            try:
                payload = json.loads(m.group(2))
                identifier = payload.get("board") or payload.get("id")
                if identifier:
                    status = payload.get("pass", True if m.group(1) in ("PASS_ORIGINAL_RENDERER", "BOARD_AUDIT") else None)
                    observations.append({"board": identifier, "status": status, "error": payload.get("error")})
                    if m.group(1) != "BOARD_AUDIT":
                        board_results[identifier] = {"pass": status, "error": payload.get("error"), "test": name}
            except json.JSONDecodeError:
                pass
        if "##[error]" in line or "Error:" in line or "failed" in line.lower():
            if len(errors) < 10:
                errors.append(line[:300])
    groups[name] = {"observations": observations, "errors": errors,
                    "logFound": bool(lines)}
    for matrix_name in ("remaining-render-matrix.json", "page4-render-matrix.json", "native-page4-matrix.json"):
        mpath = group / matrix_name
        if not mpath.exists():
            continue
        try:
            matrix = json.loads(mpath.read_text())
            for item in matrix.get("results", []):
                identifier = item.get("board")
                if identifier:
                    board_results[identifier] = {"pass": bool(item.get("pass")),
                                                 "error": item.get("error"),
                                                 "test": name}
        except (ValueError, OSError):
            pass

gates = {
    "contracts": os.getenv("CONTRACTS", "unknown"),
    "publicCoreSource": os.getenv("SOURCE", "unknown"),
    "exactStagingDeployment": os.getenv("DEPLOY", "unknown"),
    "browserSuites": os.getenv("BROWSERS", "unknown")
}
ready = all(x == "success" for x in gates.values())
payload = {
    "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceCommit": os.getenv("GITHUB_SHA", ""),
    "description": "Automated staging validation only; physical Onn receiver not verified",
    "gates": gates, "automatedStagingPassed": ready,
    "boardResults": board_results, "suites": groups,
    "physicalOnnVerified": False, "productionCutoverAuthorized": False
}
(out / "latest.json").write_text(json.dumps(payload, indent=2) + "\n")
lines = ["# Man Cave — one-shot Cloudflare acceptance report", "",
         "GitHub revision: " + payload["sourceCommit"],
         "Checked: " + payload["checkedAt"], "",
         "| Gate | Result |", "|---|---|"]
for key, result in gates.items():
    lines.append("| " + key + " | " + result + " |")
lines += ["", "## Individual renderer observations", "",
          "| Board | Pass | Problem |", "|---|---|---|"]
for board, result in sorted(board_results.items()):
    problem = (result.get("error") or "").replace("|", "/").replace("\n", " ")[:130]
    lines.append("| " + board + " | " + str(result.get("pass")) + " | " + problem + " |")
lines += ["", "## Safety",
          "No approved artwork, Firebase assignments, Xfinity/Yahoo systems or production TV addresses were changed.",
          "A complete green browser suite cannot replace physical Onn testing."]
(out / "latest.md").write_text("\n".join(lines) + "\n")
print("BATCH_ACCEPTANCE_REPORT", "boardsObserved", len(board_results),
      "automatedStagingPassed", ready, "suites", len(groups), flush=True)
