#!/usr/bin/env python3
"""Enable Murdoch's recurring guide jobs by declaration key.

The one-off campaign runs through 2026-09-05. This helper is scheduled once on
2026-09-07 so the Tuesday/Saturday recurring cadence cannot overlap it.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess


AGENT = "contents_chief_director"
DECLARATION_KEYS = {
    "caelus.murdoch.guide.generate.v2",
    "caelus.murdoch.guide.preview.v2",
    "caelus.murdoch.guide.publish.v2",
}


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["openclaw", *args],
        check=False,
        text=True,
        capture_output=True,
        timeout=60,
    )


def main() -> int:
    if os.environ.get("CAELUS_ENABLE_CARD_PUBLISHING", "0").strip().lower() not in {"1", "true", "yes"}:
        print(json.dumps({
            "ok": True,
            "status": "kept_disabled",
            "reason": "Instagram 발행과 신규 카드 생성이 비활성이므로 정규 가이드 일정을 활성화하지 않습니다.",
        }, ensure_ascii=False))
        return 0
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    listed = run("cron", "list", "--all", "--agent", AGENT, "--json")
    if listed.returncode:
        raise SystemExit((listed.stderr or listed.stdout)[-1000:])

    jobs = json.loads(listed.stdout).get("jobs", [])
    matches = {job.get("declarationKey"): job for job in jobs if job.get("declarationKey") in DECLARATION_KEYS}
    missing = DECLARATION_KEYS - matches.keys()
    if missing:
        raise SystemExit(f"필수 예약 작업을 찾지 못했습니다: {', '.join(sorted(missing))}")

    changed: list[str] = []
    for key in sorted(DECLARATION_KEYS):
        job = matches[key]
        if job.get("enabled"):
            continue
        if not args.dry_run:
            enabled = run("cron", "enable", str(job["id"]))
            if enabled.returncode:
                raise SystemExit((enabled.stderr or enabled.stdout)[-1000:])
        changed.append(key)

    print(json.dumps({"dryRun": args.dry_run, "enabled": changed}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
