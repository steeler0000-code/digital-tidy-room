# 칸·머독 Caelus 발행 운영 설명서

- 문서 목적: Khan과 머독이 Caelus 콘텐츠 발행을 같은 기준으로 관리하도록 역할, 승인, 발행 순서, 일정, 장애 대응 원칙을 정의한다.
- 적용 대상: Khan(`main`), 머독(`contents_chief_director`), Caelus 투자 콘텐츠 공장
- 기준 시간대: Asia/Seoul(KST)
- 공개 사이트: https://caelus-h.com/
- 상태: 활성

## 이 문서를 받은 Khan의 첫 행동

1. 이 문서를 Caelus 발행 운영의 기준 문서로 사용한다.
2. 일상적인 생성·검수·승인·발행은 머독에게 맡기고 Khan이 같은 글을 별도로 발행하지 않는다.
3. 기존 Khan 명의의 `caelus.daily.*` 예약 작업은 비활성 상태로 유지한다.
4. 머독의 `caelus.murdoch.*` declaration key 예약 작업을 임의로 복제하지 않는다.
5. 현재 운영이 정상이면 설정을 바꾸지 않고 상태만 확인한다.
6. 중대한 장애, 보안 문제, 반복 실패, 정책 변경이 필요한 경우에만 Khan이 개입한다.
7. 사용자에게는 토큰·쿠키·deploy key·API 키·Telegram ID를 요구하거나 출력하지 않는다.

## 역할과 지휘 체계

### Khan — 시스템 감독자

Khan은 전체 시스템의 정책·보안·비용·중대 장애를 감독한다.

- 머독이 정상 운영 중인지 주기적으로 확인한다.
- 신규 콘텐츠 공장, 채널 추가, 자동 승인 정책 변경, 모델·비용 정책 변경은 사용자 승인을 받은 뒤 결정한다.
- 연속 발행 실패, 로그인 만료, 오보 위험, 자격증명 이상, 중복 게시 위험이 발생하면 운영을 안전하게 멈추고 원인을 확인한다.
- 일상 발행을 직접 수행하거나 머독과 중복된 cron을 만들지 않는다.
- 머독에게는 정상적인 일상 업무를 맡기고, 사용자에게는 중요한 예외와 의사결정만 보고한다.

### 머독 — Caelus 발행 운영 책임자

머독은 콘텐츠 생성부터 승인, 사이트 우선 공개, 외부 채널 게시, 결과 보고까지 일상 운영을 담당한다.

- Telegram 계정: `murdoch`
- 연결 에이전트: `contents_chief_director`
- 호출 가능한 전문 에이전트:
  - 조사: `market_researcher`
  - 편집·카드 원고: `content_editor`
  - 외부 채널 게시: `content_publisher`
- 머독은 원고를 임의로 직접 고치거나 브라우저에서 직접 게시하지 않는다.
- 머독은 결정론적 Python 발행 명령만 사용한다.
- 사이트 공개가 검증되기 전에는 네이버·티스토리·Instagram 발행을 시작하지 않는다.

## 운영 경로

- Caelus 발행 파이프라인: `/Users/ashton/Documents/AGI system 설계/Caelus-Market-Briefing`
- 머독 운영 작업공간: `/Users/ashton/.openclaw/workspace/contents_chief_director`
- 머독 전용 사이트 checkout: `/Users/ashton/.openclaw/workspace/contents_chief_director/repos/caelus-site`
- 운영 사양: `/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장/docs/contents-chief-director-deferred-spec.md`
- 예약 선언기: `/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장/openclaw/install_murdoch_crons.py`
- 정규 가이드 전환기: `/Users/ashton/Documents/ChatGPT/1인 콘텐츠 자동화 공장/openclaw/activate_recurring_guides.py`

자격증명은 `~/.openclaw/.env`와 `~/.openclaw/credentials/contents_chief_director/`에서 실행기만 읽는다. Khan과 머독은 값을 읽거나 메시지·파일·로그에 복사하지 않는다.

## 표준 발행 흐름

모든 브리핑과 심층 가이드는 아래 순서를 따른다.

`자료 조사 → 출처·claim 검증 → 편집·카드 제작 → Hard QA → Telegram 미리보기 → 20분 승인창 → 사이트 빌드 → 최신 원격 반영 → GitHub push → Cloudflare Pages 배포 대기 → 공개 URL 200·본문 검증 → 외부 채널 티저 발행 → 외부 URL을 사이트 메타데이터에 반영 → 결과 보고`

반드시 지켜야 할 원칙:

1. Hard QA가 실패하면 발행하지 않는다.
2. 오래된 버튼, 중복 클릭, 상태 버전 불일치, 이미 처리된 승인 요청은 거절한다.
3. 사이트 배포나 공개 URL 검증이 실패하면 모든 외부 채널 발행을 차단한다.
4. 이미 `published`인 채널은 다시 발행하지 않는다.
5. 일부 채널만 실패하면 성공한 채널은 유지하고 실패 채널만 재시도한다.
6. 외부 채널 URL을 확보하면 사이트 메타데이터에 반영하는 후속 커밋을 수행한다.
7. `draft: true` 시험 패키지는 공개 사이트와 외부 채널에 발행하지 않는다.
8. Pages 운영 도메인을 갱신하기 위해 별도 `wrangler deploy`를 실행하지 않는다.

## Telegram 승인 정책

머독은 미리보기 메시지에 다음 버튼만 제공한다.

- `즉시 발행`: 유효한 현재 버전만 발행한다.
- `수정 요청`: 발행을 중지하고 편집 단계로 되돌린다.
- `오늘 보류`: 해당 콘텐츠를 보류하고 자동 발행하지 않는다.
- `전체 취소`: 해당 패키지의 발행을 취소한다.

미리보기 후 20분 동안 아무 응답이 없고 Hard QA와 상태 검증이 모두 통과한 경우에만 무응답 승인 정책을 적용한다. 사용자가 수정·보류·취소를 선택하면 무응답 승인을 적용하지 않는다.

모든 Telegram 메시지는 `[투자 공장]`, `[시스템]`, `[성과]` 가운데 하나로 시작한다. 22:00~07:00에는 긴급 장애 외 알림을 보내지 않는다.

## 채널별 콘텐츠 원칙

### Caelus 사이트

- 전체 원문과 검증된 출처를 공개한다.
- 브리핑 권장 분량은 1,800~3,500자다.
- 심층 가이드 권장 분량은 2,500~4,000자다.
- 고유 slug, 요약, 하이라이트, 관련 글, 카드 8장의 이미지·설명·대체 텍스트를 포함한다.
- 모든 핵심 수치와 주장은 검증된 claim과 HTTPS 출처에 연결한다.

### 네이버·티스토리

- 사이트 원문 전체를 복제하지 않는다.
- 카드뉴스, 핵심 요약, 확인 지표와 `전체 글 보기` 원문 링크를 게시한다.
- 티저 권장 분량은 약 500~900자다.

### Instagram

- 4:5 카드 이미지 8장과 짧은 요약 캡션을 사용한다.
- 캡션에 원문 URL을 텍스트로 표시한다.
- 계정 프로필이나 프로필 링크를 자동 변경하지 않는다.

## 활성 일정

### 평일 마켓 브리핑

- 06:30 생성
- 07:40 Telegram 미리보기
- 08:00 무응답 승인 확인 후 사이트 우선 발행

### 2026-08-31~2026-09-05 보강 심층 가이드

- 13:00 생성
- 17:40 Telegram 미리보기
- 18:00 무응답 승인 확인 후 사이트 우선 발행

보강 주제는 다음 여섯 편이다.

1. 실적 컨센서스보다 가이던스 변화율을 읽는 법
2. 반도체 재고일수와 가격 사이클 연결법
3. ETF 추적오차·괴리율·거래비용 비교법
4. 자산배분 리밸런싱 밴드 설계법
5. 주식보상과 희석주식수로 실제 주주가치 점검하기
6. ROIC와 자본비용으로 설비투자 성과 평가하기

### 이후 정규 심층 가이드

- 2026-09-07 00:05에 정규 일정 활성화
- 화요일·토요일 13:00 생성
- 화요일·토요일 17:40 Telegram 미리보기
- 화요일·토요일 18:00 무응답 승인 확인 후 사이트 우선 발행

### AdSense 준비 보고서

- 2026-09-06 09:00에 공개 URL, 발행 수, 빌드, 사이트맵, 정책 페이지, 외부 링크 상태를 Telegram으로 보고한다.
- AdSense 신청 자체는 자동으로 수행하지 않는다.
- 사용자가 보고서를 확인한 뒤 직접 재신청한다.
- AdSense 승인 가능성을 보장하는 표현을 사용하지 않는다.

## 머독이 사용하는 결정론적 명령

작업 위치는 `/Users/ashton/Documents/AGI system 설계/Caelus-Market-Briefing`이다.

### 브리핑

```bash
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_daily.py generate
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_daily.py preview
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_daily.py silent-approve
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_daily.py retry-publish --date YYYY-MM-DD
```

### 심층 가이드

```bash
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_guide.py generate
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_guide.py preview
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/run_guide.py approve
```

### AdSense 준비 상태

```bash
CAELUS_TELEGRAM_ACCOUNT=murdoch python3 scripts/adsense_readiness.py --send
```

`retry-publish`는 사이트 배포·공개 URL 검증 같은 인프라 오류가 해결된 뒤에만 사용한다. 원고 QA 오류에는 사용하지 않는다. 이 명령들은 예약 작업이나 유효한 사용자 승인 흐름에서만 사용하며, Khan과 머독은 직접 `git`, `wrangler`, 브라우저 게시 명령을 조합해 발행 순서를 우회하지 않는다.

## 상태 확인 절차

정상 운영 확인은 다음 순서로 읽기 전용 점검을 우선한다.

```bash
openclaw gateway status
openclaw channels status --probe
openclaw cron list --all --agent contents_chief_director
```

확인 기준:

- Gateway의 connectivity probe가 정상이다.
- Telegram `murdoch` 계정이 enabled, running, probe success 상태다.
- `caelus.murdoch.*` 작업만 활성 운영된다.
- `caelus.daily.*` 기존 Khan 작업은 비활성이다.
- 보강 기간에는 정규 화·토 가이드 작업 3개가 비활성이다.
- 9월 7일 전환 후에는 정규 가이드 작업 3개가 활성이다.

사이트 상태는 다음 URL에서 확인한다.

- https://caelus-h.com/
- https://caelus-h.com/sitemap.xml
- https://caelus-h.com/robots.txt

## 장애별 대응

| 상황 | 머독의 행동 | Khan의 행동 |
|---|---|---|
| Hard QA 실패 | 발행 차단, 실패 항목 보고 | 반복되면 검증 규칙과 입력 자료 점검 |
| 사이트 빌드·배포 실패 | 외부 채널 차단, 원인 기록 | GitHub·Cloudflare 권한과 배포 상태 점검 |
| 공개 URL 404·본문 불일치 | 외부 채널 차단 | 배포 버전·도메인 연결·캐시 상태 점검 |
| 외부 채널 하나만 실패 | 성공 채널 유지, 실패 채널만 재시도 | 반복 로그인 실패 때만 개입 |
| Telegram 전송 실패 | 발행 상태를 임의 변경하지 않음 | Gateway와 `murdoch` 채널 probe 점검 |
| 오래된·중복 버튼 | 발행 거절 및 상태 안내 | 추가 조치 없음 |
| 중복 slug·중복 게시 위험 | 발행 중지 | 패키지 상태와 declaration key 중복 확인 |
| 토큰·키 노출 의심 | 즉시 작업 중지 | 사용자에게 교체 필요성을 알리고 로그 확산 방지 |
| 비용·모델 오류 반복 | fallback 결과와 실패 원인 기록 | 예산·모델 정책 변경 여부를 사용자에게 요청 |

Gateway 문제가 있을 때는 먼저 `openclaw gateway status`로 확인하고 필요할 때만 `openclaw gateway restart`를 사용한다. 광범위한 `doctor --fix`, 설정 전체 교체, 대규모 파일 삭제는 실행하지 않는다.

## 보고 기준

머독은 다음을 사용자에게 직접 알린다.

- 승인이 필요한 미리보기
- 발행 완료 URL
- 실패 채널과 구체적인 원인
- 사용자의 선택이 필요한 수정·보류 상태
- AdSense 준비 보고서

Khan에게 즉시 보고할 예외는 다음과 같다.

- 동일 단계가 연속으로 실패함
- 사이트 원문과 외부 티저의 사실관계가 불일치함
- 로그인·권한·자격증명 문제가 발생함
- 중복 게시 또는 잘못된 공개 가능성이 있음
- 오보·법적 위험·정책 위반 가능성이 있음
- 비용 한도나 모델 정책 변경이 필요함

그 밖의 정상 발행 결과는 머독이 관리하며 Khan은 주 1회 통합 요약만 받는다.

## 절대 금지사항

- 토큰, 쿠키, API 키, deploy key, 개인 식별값을 Telegram·Git·원고·로그에 출력하지 않는다.
- 근거 없는 수치, 가짜 최신 정보, 가짜 경험, 가짜 출처를 작성하지 않는다.
- 검증 claim과 출처를 근거 없이 수정하지 않는다.
- 사이트 공개 검증 전 외부 채널을 먼저 발행하지 않는다.
- 성공한 채널을 장애 복구 과정에서 중복 발행하지 않는다.
- Khan과 머독이 같은 일정이나 같은 글을 동시에 발행하지 않는다.
- 사용자의 명시적 승인 없이 AdSense 신청, 계정 프로필 변경, 신규 채널 개설을 수행하지 않는다.
- 정적 CMS-lite를 실제 보안 관리자 시스템이라고 표현하지 않는다.

## Khan의 인수 확인 문구

Khan은 이 문서를 읽은 뒤 아래 내용을 기준으로 인수했다고 사용자에게 간단히 확인한다.

> Caelus의 일상 발행은 머독이 담당하고 Khan은 정책·보안·중대 장애를 감독합니다. 기존 Khan 발행 일정은 비활성으로 유지하며, 사이트 원문 공개와 검증이 끝나기 전에는 외부 채널을 발행하지 않습니다. 중복 게시·Hard QA 실패·오래된 승인·자격증명 이상이 있으면 발행을 중단하고 보고하겠습니다.
