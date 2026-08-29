# Caelus

한국 독자를 위해 국내·미국 주식, ETF, 금리·환율과 기업 공시를 설명하는 정적 경제·투자 정보 사이트입니다. Astro로 빌드하고 Cloudflare Workers Static Assets에 배포합니다.

## 현재 공개 콘텐츠

- 2026년 8월 16·17·19~28일 마켓 브리핑 12편
- 최근 투자 관심사를 판단 방법으로 바꾼 가이드 12편
- 복리, 환율 포함 수익률, 자산배분 계산기 3종
- 소개, 운영자, 편집 원칙, 문의, 개인정보, 약관과 면책 문서

과거 브리핑은 당시 시장 기록이며 현재 투자 판단 자료로 그대로 사용할 수 없습니다. 모든 콘텐츠는 일반 정보이며 투자자문이나 매매 권유가 아닙니다.

## 실행과 검증

Node.js 22.12 이상이 필요합니다.

```bash
npm install
npm run dev
npm run build
```

`npm run build`는 계산기 테스트, 콘텐츠 수·날짜·출처 검증, Astro 타입 검사, 정적 빌드와 내부 링크 검사를 실행합니다.

## 콘텐츠 위치

- 사이트 설정: `src/config/site.ts`
- 브리핑: `src/content/briefings/*.md`
- 투자 가이드: `src/content/guides/*.md`
- 가이드 카테고리: `src/data/categories.ts`
- 투자 도구 등록: `src/data/tools.ts`
- 계산 로직: `src/lib/calculators/index.ts`
- 콘텐츠 입력 계약: `docs/CONTENT_CONTRACT.md`

## 배포

공개 주소는 `https://caelus-h.com`입니다. 배포 전 다음 검사를 통과해야 합니다.

```bash
SITE_URL=https://caelus-h.com npm run build
npm run deploy:check
npm run deploy
```

매일 실행되던 GitHub 예약 발행은 중지되어 있습니다. OpenClaw 자동 발행은 사이트가 안정된 뒤 별도 단계에서 콘텐츠 계약과 사람 승인 절차에 맞춰 연결합니다.

## 광고와 개인정보

AdSense 계정 확인 메타와 `ads.txt`만 유지하며 광고 단위는 넣지 않았습니다. 계산기 입력값은 브라우저 안에서만 처리하고 저장하거나 전송하지 않습니다.
