# Caelus 콘텐츠 입력 계약

이 문서는 OpenClaw 승인형 발행기가 생성해야 할 최소 Markdown 형식을 정의합니다. 머독 일정은 전용 Telegram과 최소 권한 자격증명 연결 후 활성화합니다.

## 공통 규칙

- UTF-8 Markdown과 YAML frontmatter를 사용합니다.
- `slug`는 영문 소문자·숫자·하이픈만 허용합니다.
- 공개하려면 `draft: false`, `editorialApproved: true`, 실제 `publishedAt`이 모두 필요합니다.
- 모든 수치형 핵심 주장에는 공개 HTTPS 출처가 있어야 합니다.
- 매수·매도 신호, 목표가, 수익 보장, 허위 경험과 확인되지 않은 최신 사실을 넣지 않습니다.
- 공개 전 사람이 본문과 출처를 승인해야 합니다.
- `contentTier: flagship` 콘텐츠는 `cards`가 정확히 8개여야 합니다. 각 카드는 이미지 경로, 제목, 40자 이상의 상세 설명, 15~120자의 대체 텍스트를 가집니다.
- 외부 채널 발행이 끝나면 `externalChannels`에 공개 URL만 기록합니다.

## 브리핑

파일은 `src/content/briefings/YYYY-MM-DD.md`, slug는 같은 `YYYY-MM-DD`를 사용합니다. 필수 필드는 제목, 설명, 부제, 작성자, 최초 발행일, 검토일, 핵심 요약, 2개 이상의 하이라이트, 출처, 브리핑 날짜, 1개 이상의 주제·시장입니다.

제목은 `YYYY년 M월 D일 Caelus 마켓 브리핑 — 핵심 이슈` 형식입니다. 사이트 본문은 1,800~3,500자로 사실, 전달 경로, 상방·하방 요인, 다음 확인 지표와 투자 면책을 구분합니다.

## 투자 가이드

파일은 `src/content/guides/<slug>.md`에 저장합니다. 카테고리는 `market-signals`, `global-investing`, `etf-structure`, `company-analysis` 중 하나입니다. 사이트 본문은 2,500~4,000자로 문제 제기, 핵심 설명, 실제 적용법, 흔한 오류, 점검표와 면책을 포함합니다.

## 발행 게이트

`npm run build` 성공, 출처 접근 가능성, 금지 표현, 날짜 일치, 중복 slug, 승인 상태와 Telegram 승인 버전을 모두 통과한 커밋만 배포 대상으로 삼습니다. 네이버·티스토리는 500~900자 카드뉴스 티저와 사이트 원문 링크만 사용하고, Instagram은 4:5 카드 8장과 짧은 캡션을 사용합니다. 자동화 토큰과 비밀값은 이 저장소에 저장하지 않습니다.
