#!/usr/bin/env python3
"""Declare Murdoch's daily Caelus dashboard refresh job idempotently."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess


SITE = Path("/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장")
JOBS = [
    {
        "key": "caelus.murdoch.dashboard.refresh.v1",
        "name": "Caelus 머독 06:00 시장 대시보드 갱신",
        "cron": "0 6 * * 1-5",
        "argv": ["node", "scripts/publish-dashboard.mjs"],
        "timeout": "1200",
    },
    {
        "key": "caelus.murdoch.dashboard.report.v1",
        "name": "Caelus 머독 07:05 대시보드 결과 보고",
        "cron": "5 7 * * 1-5",
        "argv": ["node", "scripts/report-dashboard-status.mjs"],
        "timeout": "120",
    },
]


def command(job: dict[str, object]) -> list[str]:
    return [
        "openclaw", "cron", "add",
        "--declaration-key", str(job["key"]),
        "--name", str(job["name"]),
        "--display-name", str(job["name"]),
        "--agent", "contents_chief_director",
        "--session", "isolated",
        "--cron", str(job["cron"]),
        "--tz", "Asia/Seoul",
        "--exact",
        "--command-cwd", str(SITE),
        "--command-argv", json.dumps(job["argv"], ensure_ascii=False),
        "--timeout-seconds", str(job["timeout"]),
        "--no-output-timeout-seconds", str(job["timeout"]),
        "--no-deliver",
        "--output-max-bytes", "12000",
        "--json",
    ]


def main() -> int:
    installed = []
    for declaration in JOBS:
        completed = subprocess.run(command(declaration), check=False, text=True, capture_output=True, timeout=60)
        if completed.returncode:
            raise SystemExit((completed.stderr or completed.stdout)[-1000:])
        result = json.loads(completed.stdout)
        job = result.get("job", result)
        installed.append({
            "declarationKey": declaration["key"],
            "id": job.get("id"),
            "enabled": job.get("enabled"),
        })
    print(json.dumps(installed, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
