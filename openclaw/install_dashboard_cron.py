#!/usr/bin/env python3
"""Declare Murdoch's daily Caelus dashboard refresh job idempotently."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess


SITE = Path("/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장")
COMMAND = [
    "openclaw", "cron", "add",
    "--declaration-key", "caelus.murdoch.dashboard.refresh.v1",
    "--name", "Caelus 머독 06:00 시장 대시보드 갱신",
    "--display-name", "Caelus 머독 06:00 시장 대시보드 갱신",
    "--agent", "contents_chief_director",
    "--session", "isolated",
    "--cron", "0 6 * * 1-5",
    "--tz", "Asia/Seoul",
    "--exact",
    "--command-cwd", str(SITE),
    "--command-argv", json.dumps(["node", "scripts/publish-dashboard.mjs"], ensure_ascii=False),
    "--timeout-seconds", "1200",
    "--no-output-timeout-seconds", "900",
    "--no-deliver",
    "--output-max-bytes", "12000",
    "--json",
]


def main() -> int:
    completed = subprocess.run(COMMAND, check=False, text=True, capture_output=True, timeout=60)
    if completed.returncode:
        raise SystemExit((completed.stderr or completed.stdout)[-1000:])
    result = json.loads(completed.stdout)
    job = result.get("job", result)
    print(json.dumps({
        "declarationKey": "caelus.murdoch.dashboard.refresh.v1",
        "id": job.get("id"),
        "enabled": job.get("enabled"),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
