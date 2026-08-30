# 승인형 발행 상태

GitHub Actions는 수동 검증 전용입니다. 예약 발행은 OpenClaw의 머독(`contents_chief_director`)이 로컬에서 지휘하며, 공개 사이트는 GitHub `main`과 연결된 Cloudflare Pages가 배포합니다.

공개 순서는 다음과 같이 고정합니다.

1. 검증된 패키지에서 사이트 원문 Markdown·출처·카드 8장·카드 설명을 생성합니다.
2. 격리된 `digital-tidy-room` checkout에서 사이트를 빌드합니다.
3. 원격 `main`을 반영해 커밋을 정리하고 사이트 커밋을 GitHub에 push합니다.
4. Cloudflare Pages 배포를 기다린 뒤 공개 URL의 HTTP 200과 본문을 검증합니다.
5. 네이버·티스토리·Instagram 티저를 발행합니다.
6. 외부 채널 URL을 사이트 메타데이터에 반영합니다.

사이트 공개 검증이 실패하면 모든 외부 채널을 차단합니다. 이미 성공한 채널은 재발행하지 않고 실패한 채널만 재시도합니다. 브리핑과 심층 가이드는 Telegram 미리보기 후 20분 동안 수정·보류·취소가 없을 때만 발행합니다.

사이트 인프라 오류로 `blocked`가 된 패키지는 콘텐츠를 다시 고치는 `repair-output`을 반복하지 않습니다. 원인이 해결된 뒤 `retry-publish` 경로로 승인된 원고를 그대로 재개합니다. 별도 `wrangler deploy`는 Workers 주소만 갱신하므로 Pages 운영 도메인 발행에 사용하지 않습니다.

비밀값은 `~/.openclaw/.env`와 전용 로컬 자격증명 디렉터리에만 저장하며 이 저장소, 원고, Telegram 메시지와 실행 로그에 넣지 않습니다.
