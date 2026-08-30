#!/usr/bin/env python3
"""Store one Murdoch secret in ~/.openclaw/.env without echoing its value."""

from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path
import tempfile


ALLOWED = {
    "MURDOCH_TELEGRAM_BOT_TOKEN": "BotFather가 발급한 머독 Telegram bot token",
    "CLOUDFLARE_API_TOKEN": "Caelus 배포용 Cloudflare API token",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", choices=tuple(ALLOWED))
    parser.add_argument("--from-file", type=Path, help="값을 담은 권한 600 임시 파일")
    args = parser.parse_args()
    if args.from_file:
        mode = args.from_file.stat().st_mode & 0o777
        if mode & 0o077:
            raise SystemExit("임시 파일 권한이 너무 넓습니다. 저장하지 않았습니다.")
        value = args.from_file.read_text(encoding="utf-8").strip()
    else:
        value = getpass.getpass(f"{ALLOWED[args.name]}을 붙여넣고 Enter: ").strip()
    if len(value) < 20 or any(char.isspace() for char in value):
        raise SystemExit("값 형식이 올바르지 않습니다. 저장하지 않았습니다.")
    env_path = Path.home() / ".openclaw" / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    updated = [line for line in lines if not line.startswith(f"{args.name}=")]
    updated.append(f"{args.name}={value}")
    env_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=".env.", dir=env_path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write("\n".join(updated) + "\n")
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, env_path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    print(f"{args.name} 저장 완료 (값은 표시하지 않음)")
    if args.from_file:
        args.from_file.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
