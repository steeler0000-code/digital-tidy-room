#!/usr/bin/env python3
"""Install the isolated Caelus site engineer and connect it to Khan."""

from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


SOURCE = Path("/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장")
OPENCLAW = Path("/Users/ashton/.openclaw")
CONFIG = OPENCLAW / "openclaw.json"
APPROVALS = OPENCLAW / "exec-approvals.json"
WORKSPACE = OPENCLAW / "workspace" / "caelus_site_engineer"
AGENT_DIR = OPENCLAW / "agents" / "caelus_site_engineer" / "agent"
TEMPLATE = SOURCE / "openclaw" / "caelus_site_engineer-template"
CHECKOUT = WORKSPACE / "repos" / "caelus-site"
WRAPPER = WORKSPACE / "bin" / "caelus-engineer"
KHAN_AGENTS = OPENCLAW / "workspace" / "AGENTS.md"
MURDOCH_AGENTS = OPENCLAW / "workspace" / "contents_chief_director" / "AGENTS.md"

KHAN_MARKER = "<!-- caelus-site-engineer:start -->"
KHAN_BLOCK = f"""{KHAN_MARKER}
## Caelus 사이트 기술 위임

- Caelus의 일상 생성·승인·발행은 머독이 담당한다.
- 코드, 빌드, Git 동시성, Cloudflare Pages 공개 검증 오류는 `caelus_site_engineer`에게 진단 또는 수정을 위임한다.
- 기준 런북은 `{SOURCE / 'docs' / 'caelus-publishing-troubleshooting.md'}`다.
- 엔지니어 결과를 검토하고 사용자에게 변경 영향과 검증 결과를 제시한다. 코드·인프라 변경은 사용자의 명시적 승인 뒤에만 운영 반영한다.
- 엔지니어에게 운영 `main` push, Cloudflare 배포, DNS·AdSense·계정 변경을 맡기지 않는다.
<!-- caelus-site-engineer:end -->"""

MURDOCH_MARKER = "<!-- caelus-site-engineer-routing:start -->"
MURDOCH_BLOCK = f"""{MURDOCH_MARKER}
## 반복 사이트 장애 라우팅

- 같은 코드·빌드·공개 URL 검증 단계가 반복 실패하면 자동 재시도 루프를 중단한다.
- 실행 ID, 마지막 성공 단계, 최초 실패 단계, 오류 한 줄, slug와 기대 URL을 Khan에게 보고한다.
- `{SOURCE / 'docs' / 'caelus-publishing-troubleshooting.md'}`를 기준으로 분류한다.
- `caelus_site_engineer`는 직접 호출하지 않는다. 기술 수정은 Khan이 승인 경계를 확인한 뒤 위임한다.
<!-- caelus-site-engineer-routing:end -->"""


def replace_block(path: Path, marker: str, block: str) -> None:
    end_marker = marker.replace(":start", ":end")
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if marker in current and end_marker in current:
        start = current.index(marker)
        end = current.index(end_marker, start) + len(end_marker)
        current = current[:start] + block + current[end:]
    else:
        current = current.rstrip() + "\n\n" + block + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(current, encoding="utf-8")


def backup() -> Path:
    destination = OPENCLAW / "backups" / f"caelus-site-engineer-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copy2(CONFIG, destination / "openclaw.json")
    if APPROVALS.exists():
        shutil.copy2(APPROVALS, destination / "exec-approvals.json")
    if KHAN_AGENTS.exists():
        shutil.copy2(KHAN_AGENTS, destination / "khan-AGENTS.md")
    if MURDOCH_AGENTS.exists():
        shutil.copy2(MURDOCH_AGENTS, destination / "murdoch-AGENTS.md")
    return destination


def install_workspace() -> None:
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    AGENT_DIR.mkdir(parents=True, exist_ok=True)
    for source in TEMPLATE.rglob("*"):
        relative = source.relative_to(TEMPLATE)
        target = WORKSPACE / relative
        if source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    os.chmod(WRAPPER, 0o755)
    if not CHECKOUT.exists():
        CHECKOUT.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--no-hardlinks", str(SOURCE), str(CHECKOUT)], check=True)


def update_config() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    agent_config = {
        "name": "Caelus 엔지니어",
        "workspace": str(WORKSPACE),
        "agentDir": str(AGENT_DIR),
        "model": {
            "primary": "openai/gpt-5.5",
            "fallbacks": ["xai/grok-4.20-beta-latest-reasoning"],
        },
        "tools": {
            "allow": [
                "read", "file_fetch", "dir_list", "dir_fetch", "memory_search", "memory_get",
                "web_search", "web_fetch", "write", "edit", "apply_patch", "file_write", "exec",
            ],
            "deny": [
                "process", "browser", "message", "cron", "gateway", "sessions_spawn", "sessions_send",
            ],
            "exec": {"host": "gateway", "mode": "allowlist"},
        },
    }
    agents_config = config.setdefault("agents", {})
    if isinstance(agents_config.get("entries"), dict):
        entries = agents_config["entries"]
        entries["caelus_site_engineer"] = agent_config
        main = entries["main"]
    else:
        agents = agents_config.setdefault("list", [])
        agents[:] = [agent for agent in agents if agent.get("id") != "caelus_site_engineer"]
        agents.append({"id": "caelus_site_engineer", **agent_config})
        main = next(agent for agent in agents if agent.get("id") == "main")
    allowed = main.setdefault("subagents", {}).setdefault("allowAgents", [])
    if "caelus_site_engineer" not in allowed:
        allowed.append("caelus_site_engineer")
    temporary = CONFIG.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(CONFIG)


def update_approvals() -> None:
    approvals = json.loads(APPROVALS.read_text(encoding="utf-8")) if APPROVALS.exists() else {"version": 1, "agents": {}}
    agent = approvals.setdefault("agents", {}).setdefault("caelus_site_engineer", {})
    allowlist = agent.setdefault("allowlist", [])
    pattern = str(WRAPPER)
    if not any(entry.get("pattern") == pattern for entry in allowlist):
        allowlist.append({"pattern": pattern})
    temporary = APPROVALS.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(approvals, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(APPROVALS)


def main() -> int:
    if not CONFIG.exists():
        print("OpenClaw 설정을 찾지 못했습니다.", file=sys.stderr)
        return 2
    saved = backup()
    try:
        install_workspace()
        update_config()
        update_approvals()
        replace_block(KHAN_AGENTS, KHAN_MARKER, KHAN_BLOCK)
        replace_block(MURDOCH_AGENTS, MURDOCH_MARKER, MURDOCH_BLOCK)
        subprocess.run(["openclaw", "config", "validate"], check=True)
    except Exception:
        shutil.copy2(saved / "openclaw.json", CONFIG)
        if (saved / "exec-approvals.json").exists():
            shutil.copy2(saved / "exec-approvals.json", APPROVALS)
        if (saved / "khan-AGENTS.md").exists():
            shutil.copy2(saved / "khan-AGENTS.md", KHAN_AGENTS)
        if (saved / "murdoch-AGENTS.md").exists():
            shutil.copy2(saved / "murdoch-AGENTS.md", MURDOCH_AGENTS)
        raise
    print(json.dumps({
        "agent": "caelus_site_engineer",
        "workspace": str(WORKSPACE),
        "checkout": str(CHECKOUT),
        "backup": str(saved),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
