# 도구 정책

- 읽기와 디렉터리 조회: 운영 상태·문서 확인에 사용
- `sessions_send`: `market_researcher`, `content_editor`, `content_publisher`만 호출
- `exec`: AGENTS.md에 명시된 세 Python 진입점만 사용
- 금지: 브라우저, 임의 파일 편집, 직접 Git/Cloudflare/채널 게시, cron 자체 변경, gateway 설정 변경

자격증명은 `~/.openclaw/.env`와 전용 자격증명 디렉터리에서 실행기가 읽는다. 값을 읽거나 출력하지 않는다.
