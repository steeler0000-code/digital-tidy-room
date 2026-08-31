# Caelus

한국 독자를 위해 국내·미국 주식, ETF, 금리·환율과 기업 공시를 설명하는 정적 경제·투자 정보 사이트입니다. Astro로 빌드하고 GitHub 연동 Cloudflare Pages에 배포합니다.

## 현재 공개 콘텐츠

- 2026년 8월 16·17·19~28일 마켓 브리핑 12편
- 최근 투자 관심사를 판단 방법으로 바꾼 가이드 12편
- 복리, 환율 포함 수익률, 자산배분 계산기 3종
- 한국·미국 금리·물가·유동성 6개 지표 대시보드
- 소개, 운영자, 편집 원칙, 문의, 개인정보, 약관과 면책 문서

과거 브리핑은 당시 시장 기록이며 현재 투자 판단 자료로 그대로 사용할 수 없습니다. 모든 콘텐츠는 일반 정보이며 투자자문이나 매매 권유가 아닙니다.

## 실행과 검증

Node.js 22.12 이상이 필요합니다.

```bash
npm install
npm run dev
npm run build
```

`npm run build`는 계산기와 발행 변환기 테스트, 콘텐츠 최소 수·날짜·출처·카드 검증, Astro 타입 검사, 정적 빌드와 공개 문서 내부 링크 검사를 실행합니다.

## 콘텐츠 위치

- 사이트 설정: `src/config/site.ts`
- 브리핑: `src/content/briefings/*.md`
- 투자 가이드: `src/content/guides/*.md`
- 가이드 카테고리: `src/data/categories.ts`
- 투자 도구 등록: `src/data/tools.ts`
- 계산 로직: `src/lib/calculators/index.ts`
- 대시보드 스냅샷: `src/data/dashboard.json`
- 공식 자료 갱신기: `scripts/refresh-dashboard-data.mjs`
- 콘텐츠 입력 계약: `docs/CONTENT_CONTRACT.md`
- 승인형 발행 순서: `docs/PUBLISHING.md`
- 브리핑 패키지 변환기: `scripts/import-caelus-package.mjs`
- 심층 가이드 패키지 변환기: `scripts/import-caelus-guide.mjs`

## 배포

공개 주소는 `https://caelus-h.com`입니다. 배포 전 다음 검사를 통과해야 합니다.

```bash
SITE_URL=https://caelus-h.com npm run build
npm run deploy:check
npm run deploy
```

GitHub 예약 발행은 수동 검증 전용입니다. OpenClaw 머독 일정은 전용 Telegram과 최소 권한 자격증명 연결 전까지 비활성 상태로 유지하며, 활성화 후에도 사이트 공개 검증을 통과해야 외부 티저를 발행합니다.

## 대시보드 갱신

`npm run dashboard:refresh`는 한국은행 ECOS와 FRED 공식 시계열을 읽어 검증을 통과한 스냅샷만 원자적으로 교체합니다. 사이트는 API 키를 브라우저로 보내지 않습니다. 한국 M2는 신·구계열 전환 기간이므로 한국은행 월간 보도자료의 검증값을 유지합니다.

`npm run dashboard:publish`는 갱신·전체 빌드·스냅샷 전용 커밋·`main` push·Cloudflare Pages 공개 확인을 순서대로 실행합니다. 머독 일정은 `openclaw/install_dashboard_cron.py`의 declaration key `caelus.murdoch.dashboard.refresh.v1`로 중복 없이 등록합니다.

## 광고와 개인정보

AdSense 계정 확인 메타와 `ads.txt`만 유지하며 광고 단위는 넣지 않았습니다. 계산기 입력값은 브라우저 안에서만 처리하고 저장하거나 전송하지 않습니다.
