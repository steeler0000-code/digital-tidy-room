# Caelus 발행 장애 대응 런북

- 적용 대상: Khan(`main`), 머독(`contents_chief_director`), Caelus 엔지니어(`caelus_site_engineer`)
- 공개 사이트: https://caelus-h.com/
- 저장소: `steeler0000-code/digital-tidy-room`
- 배포 방식: GitHub `main` 반영을 기점으로 하는 Cloudflare Pages 배포
- 기본 원칙: 원인 분류 전 재발행하지 않으며, 사이트 원문이 공개 검증되기 전 외부 채널을 열지 않는다.

## 역할과 호출 순서

1. 머독은 콘텐츠 상태와 발행 실행을 관리한다. 장애가 나면 외부 채널을 차단하고 실행 ID, 단계, 오류 한 줄, 기대 URL을 Khan에게 보낸다.
2. Khan은 아래 진단표로 콘텐츠 오류인지 인프라 오류인지 판별한다.
3. 코드·빌드·배포 로직 수정이 필요할 때만 `caelus_site_engineer`를 호출한다.
4. Caelus 엔지니어는 격리된 checkout에서 원인 재현, 최소 수정, 테스트, 변경 보고서 작성까지만 한다.
5. 운영 반영은 사용자의 명시적 승인 뒤 Khan이 수행한다. Caelus 엔지니어는 `main` 직접 push, Cloudflare 운영 배포, DNS 변경을 하지 않는다.

머독은 Caelus 엔지니어를 직접 호출하지 않는다. 콘텐츠 운영과 코드 수정의 승인 경계를 유지하기 위해 항상 Khan을 경유한다.

## 가장 먼저 할 분류

| 분류 | 대표 신호 | 재생성 필요 | 담당 |
|---|---|---:|---|
| 콘텐츠/Hard QA | 출처 누락, 분량 미달, 중복 slug, 승인 버전 불일치 | 경우에 따라 필요 | 머독 |
| 변환기/빌드 | 잘못된 날짜 제목, frontmatter 오류, 빌드 실패 | 원문 재생성 금지 | Caelus 엔지니어 |
| Git 동시성 | non-fast-forward, rebase 충돌, 원격 신규 글 존재 | 원문 재생성 금지 | Caelus 엔지니어 → Khan |
| 배포/공개 검증 | Git push 성공 후 404, 이전 본문, 타임아웃 | 원문 재생성 금지 | Khan → Caelus 엔지니어 |
| 외부 채널 | 사이트 성공 후 특정 채널 로그인/게시 실패 | 실패 채널만 재시도 | 머독 |
| 자격증명/보안 | 401/403, 키 노출 의심, 계정 불일치 | 재시도 중단 | Khan |

## 표준 증거 묶음

비밀값 없이 다음 항목을 한 번만 수집한다.

- 실행 ID와 declaration key
- 콘텐츠 종류, 날짜, slug, 기대 공개 URL
- 상태 전이의 마지막 성공 단계와 첫 실패 단계
- 로컬 HEAD, `origin/main` HEAD, 콘텐츠가 들어간 커밋
- 빌드 결과와 Cloudflare 배포 상태
- 공개 URL의 HTTP 상태, 최종 URL, 본문 식별자 확인 결과
- 채널별 `pending/published/failed/skipped` 상태

토큰, 쿠키, API 키, deploy key, Telegram ID, 전체 환경 변수는 증거에 포함하지 않는다.

## 의사결정 트리

### 1. Hard QA 전 실패

- 원고 claim·출처·분량·승인 상태를 점검한다.
- 원고 자체가 문제면 머독이 편집 단계로 되돌린다.
- 생성된 사이트 파일만 이상하면 원고를 다시 만들지 말고 변환기를 재현한다.

### 2. 사이트 빌드 실패

```bash
npm run test
npm run validate:content
npm run build
```

- 가장 먼저 실패한 명령과 최초 오류를 기준으로 고친다.
- 생성 결과 파일을 손으로 반복 수정하지 않는다. 같은 오류가 다음 글에서 재발하므로 importer·validator·schema의 원인을 수정한다.
- 수정 후 해당 회귀 테스트와 전체 빌드를 모두 통과시킨다.

### 3. Git push 실패

```bash
git status --short
git fetch origin main
git log --oneline --decorate -5 HEAD origin/main
git diff --stat origin/main...HEAD
```

- 원격에 머독이나 다른 작업의 신규 커밋이 있으면 보존한다.
- 강제 push, `reset --hard`, 광범위한 checkout 복구를 하지 않는다.
- 자동 발행 변경은 최신 `origin/main` 위로 안전하게 rebase하고 다시 빌드한다.
- 충돌이 콘텐츠 파일에 걸리면 자동 선택하지 말고 Khan에게 보고한다.

### 4. push 성공 후 공개 URL이 404

404는 콘텐츠 QA 실패가 아니다. 다음 순서로 분리한다.

1. 기대 slug와 실제 생성 경로가 일치하는지 확인한다.
2. 해당 콘텐츠 커밋이 `origin/main`에 있는지 확인한다.
3. Cloudflare Pages가 그 커밋을 감지했는지 확인한다.
4. 배포가 진행 중이면 제한 시간 동안 지수 백오프로 기다린다.
5. 배포 성공인데 404면 빌드 출력 경로, Pages 프로젝트의 production branch, custom domain 연결을 점검한다.
6. HTTP 200뿐 아니라 제목·slug·고유 본문 식별자가 최신 콘텐츠인지 확인한다.

운영 도메인은 Pages에서 제공한다. 404를 고치기 위해 별도 `wrangler deploy`로 다른 Worker를 올리지 않는다. 공개 검증 전에는 네이버·티스토리·Instagram을 모두 `skipped`로 유지한다.

### 5. 공개 URL이 200이지만 이전 본문

- 캐시 우회를 위한 쿼리 문자열과 `Cache-Control: no-cache`로 다시 확인한다.
- 최종 응답 URL과 본문 고유 식별자를 함께 검사한다.
- 새 배포가 아직 전파 중이면 기다리되, 타임아웃 후 무한 반복하지 않는다.
- 검증 성공 뒤에만 `retry-publish`로 이어간다.

### 6. 외부 채널 일부 실패

- 사이트와 성공 채널의 URL을 유지한다.
- `published` 채널은 다시 호출하지 않는다.
- 로그인 또는 게시가 실패한 채널만 재시도한다.
- 외부 URL 후속 커밋이 실패해도 이미 공개된 채널을 중복 발행하지 않는다.

### 7. Telegram 또는 Gateway 실패

```bash
openclaw gateway status
openclaw channels status --probe
openclaw cron list --all --agent contents_chief_director
```

- 상태 확인 후 필요할 때만 Gateway를 한 번 재시작한다.
- `doctor --fix`, 설정 전체 교체, 동일 cron 복제는 하지 않는다.
- 승인 메시지 전송 실패를 승인으로 간주하지 않는다.

다중 에이전트 마이그레이션 뒤 `AgentSelectionRequiredError`와 함께 Gateway가 준비 상태를 거부하면 `agents.ownership: "explicit"`만 확인하고 끝내지 않는다. 기존 Codex 스레드 같은 소유자 없는 시스템 작업의 기준이 되도록 `agents.defaults.systemAgent.agentId`가 Khan(`main`)으로 명시됐는지 확인한다. 이 한 항목을 먼저 수정하고 재시작하며, 곧바로 광범위한 `doctor --fix`를 실행하지 않는다.

Codex 기반 에이전트에서 `effective tools.exec.mode=allowlist` 때문에 기본 모델이 fallback으로 우회되면 에이전트 설정은 `mode=auto`로 두고 실행 호스트 승인 정책을 `security=allowlist`, `ask=off`, `askFallback=deny`로 제한한다. 이렇게 해야 Codex 런타임은 시작되면서도 등록된 결정론적 래퍼 외 실행은 거부된다. 구형 `exec-approvals.json`이 SQLite로 이전된 뒤에는 이 파일을 다시 만들지 말고 `openclaw approvals get/set --gateway`로 같은 저장소를 갱신한다.

## 실제 발생 사례와 영구 조치

### 날짜 제목이 `2026년 2026월 8일`로 생성됨

- 분류: 변환기 오류
- 원인: 입력 날짜를 연·월·일로 분리하지 않고 문자열 치환으로 조합함
- 올바른 조치: `import-caelus-package.mjs`의 날짜 파서를 수정하고 회귀 테스트 추가
- 잘못된 조치: 생성된 Markdown 한 편만 손으로 수정하거나 원고 전체를 재생성

### QA 통과 후 공개 URL 404가 반복됨

- 분류: 배포/공개 검증 오류
- 의미: `ready_to_publish`까지는 정상이며 사이트 공개만 완료되지 않음
- 올바른 조치: 커밋 포함 여부 → Pages 배포 커밋 → 출력 경로 → 도메인 순서로 확인하고, 해결 뒤 `retry-publish` 실행
- 잘못된 조치: `repair-output`으로 원고를 다시 만들기, 외부 채널만 먼저 게시, 무한 publishing/blocked 반복

### 원격 변경과 자동 대시보드 커밋이 충돌함

- 분류: Git 동시성
- 영구 조치: 실행 전후 `fetch + rebase`, 추적 파일 dirty 차단, force push 금지
- 주의: 원격에서 제거된 지표나 새 브리핑을 자동화가 되살리지 않도록 최신 원격 기준으로 다시 빌드한다.

### 대시보드 전년 비교가 2026년에 고정됨

- 분류: 데이터 변환기 오류
- 영구 조치: 문자열의 `2026 → 2025` 치환 대신 날짜를 12개월 이동하고 회귀 테스트로 하드코딩을 금지한다.

### 06:00 성공 알림이 조용한 시간 정책을 위반함

- 분류: 운영 규칙
- 영구 조치: 06:00 갱신은 상태 파일만 기록하고, 정상 결과는 07:05 별도 작업이 한 번만 보고한다. 긴급 실패는 즉시 보고할 수 있다.

## 재시도와 중단 기준

- 콘텐츠 오류: 수정·재검수 후 새 승인 버전으로 진행한다.
- 인프라 오류: 원고를 보존하고 원인 해결 뒤 `retry-publish`를 한 번 실행한다.
- 같은 단계가 세 번 반복 실패하면 자동 루프를 중단하고 Khan에게 증거 묶음을 보낸다.
- 401/403, 키 노출 의심, 계정 불일치, 예상 밖 프로젝트 배포는 즉시 중단한다.
- 성공 채널 재발행, force push, 자동 DNS 변경, 자동 AdSense 신청은 금지한다.

## 복구 완료 조건

다음을 모두 충족해야 해결로 기록한다.

1. 테스트, 콘텐츠 검증, 사이트 빌드 성공
2. 의도한 커밋이 `origin/main`에 존재
3. 공개 URL HTTP 200과 최신 본문 식별자 일치
4. 사이트맵에 신규 공개 글 반영
5. 외부 채널은 사이트 검증 뒤 실행되고 중복 게시 없음
6. 실행 상태가 `published` 또는 명시적 `partial`로 종료되어 blocked 루프가 없음
7. 원인, 수정, 검증, 재발 방지 테스트가 장애 기록에 남음
