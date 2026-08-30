#!/usr/bin/env python3
"""Idempotently declare Murdoch Caelus cron jobs in disabled state."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import subprocess


PIPELINE = Path("/Users/ashton/Documents/AGI system 설계/Caelus-Market-Briefing")
AGENT = "contents_chief_director"
COMMON = [
    "--agent", AGENT, "--session", "isolated", "--disabled", "--no-deliver",
    "--command-cwd", str(PIPELINE), "--command-env", "CAELUS_TELEGRAM_ACCOUNT=murdoch",
    "--output-max-bytes", "20000", "--json",
]


def declare(*, key: str, name: str, argv: list[str], cron: str | None = None, at: str | None = None, timeout: int = 3600) -> None:
    command = [
        "openclaw", "cron", "add", "--declaration-key", key,
        "--name", name, "--display-name", name,
        "--command-argv", json.dumps(argv, ensure_ascii=False),
        "--timeout-seconds", str(timeout), "--no-output-timeout-seconds", str(min(timeout, 2400)),
        *COMMON,
    ]
    if cron:
        command.extend(["--cron", cron, "--tz", "Asia/Seoul", "--exact"])
    elif at:
        command.extend(["--at", at, "--keep-after-run"])
    else:
        raise ValueError("cron 또는 at 필요")
    completed = subprocess.run(command, check=False, text=True, capture_output=True, timeout=60)
    if completed.returncode:
        raise RuntimeError((completed.stderr or completed.stdout)[-1000:])
    result = json.loads(completed.stdout)
    job = result.get("job", result)
    print(json.dumps({"key": key, "id": job.get("id"), "enabled": job.get("enabled")}, ensure_ascii=False))


def main() -> int:
    daily = [
        ("caelus.murdoch.briefing.generate.v2", "Caelus 머독 06:30 브리핑 생성", ["python3", "scripts/run_daily.py", "generate"], "30 6 * * 1-5", 3600),
        ("caelus.murdoch.briefing.preview.v2", "Caelus 머독 07:40 브리핑 검토창", ["python3", "scripts/run_daily.py", "preview"], "40 7 * * 1-5", 300),
        ("caelus.murdoch.briefing.publish.v2", "Caelus 머독 08:00 브리핑 승인·발행", ["python3", "scripts/run_daily.py", "silent-approve"], "0 8 * * 1-5", 3600),
        ("caelus.murdoch.guide.generate.v2", "Caelus 머독 13:00 심층 가이드 생성", ["python3", "scripts/run_guide.py", "generate"], "0 13 * * 2,6", 3600),
        ("caelus.murdoch.guide.preview.v2", "Caelus 머독 17:40 심층 가이드 검토창", ["python3", "scripts/run_guide.py", "preview"], "40 17 * * 2,6", 300),
        ("caelus.murdoch.guide.publish.v2", "Caelus 머독 18:00 심층 가이드 승인·발행", ["python3", "scripts/run_guide.py", "approve"], "0 18 * * 2,6", 3600),
    ]
    for key, name, argv, cron, timeout in daily:
        declare(key=key, name=name, argv=argv, cron=cron, timeout=timeout)

    for day in range(31, 36 + 1):
        date = dt.date(2026, 8, 31) + dt.timedelta(days=day - 31)
        date_text = date.isoformat()
        for action, hour, minute, command, timeout in (
            ("generate", 13, 0, "generate", 3600),
            ("preview", 17, 40, "preview", 300),
            ("publish", 18, 0, "approve", 3600),
        ):
            when = f"{date_text}T{hour:02d}:{minute:02d}:00+09:00"
            declare(
                key=f"caelus.murdoch.campaign.guide.{date_text}.{action}.v1",
                name=f"Caelus 보강 가이드 {date_text} {action}",
                argv=["python3", "scripts/run_guide.py", command, "--date", date_text],
                at=when, timeout=timeout,
            )
    declare(
        key="caelus.murdoch.adsense.readiness.2026-09-06.v1",
        name="Caelus AdSense 준비 보고서",
        argv=["python3", "scripts/adsense_readiness.py", "--send"],
        at="2026-09-06T09:00:00+09:00", timeout=1200,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
