# 디지털 정리실

파일·사진·이메일·백업·디지털 생활 습관을 초보자 눈높이로 설명하는 한국어 정적 정보 사이트입니다. Astro로 빌드하며 Cloudflare Pages에 그대로 배포할 수 있습니다.

애드센스 승인을 보장하거나 심사를 우회하기 위한 프로젝트가 아닙니다. 사람에게 실제로 도움이 되는 원문 콘텐츠, 운영 주체와 편집 원칙, 출처, 정책 페이지, 명확한 탐색 구조를 갖추는 데 초점을 맞췄습니다.

## 현재 공개 범위

- 정보 글: 전체 15개 중 5개 공개
- 운영자 칼럼: 전체 3개 중 1개 공개
- 나머지 문서는 `draft: true` 상태이며 페이지, 목록, XML 사이트맵에서 제외
- 공개 문서의 실제 최초 발행일: 2026-08-14
- 문의 수단: `ashtongate1125@gmail.com`
- 관리자 화면, 데이터베이스, 문의 폼 전송 기능, 광고 코드는 포함하지 않음

## 기술 구성

- Astro 7 정적 빌드
- Markdown 콘텐츠 컬렉션과 Zod 스키마
- 고유 title, description, canonical, Open Graph, Twitter Card
- Article, Breadcrumb, FAQ JSON-LD
- 자동 생성 `robots.txt`, `sitemap.xml`, HTML 사이트맵, 404 페이지
- Cloudflare 보안·캐시 헤더용 `public/_headers`
- 콘텐츠 수·날짜·출처·개인정보 및 빌드 후 내부 링크 검증

## 로컬 실행

Node.js 22.12 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드와 전체 검증은 다음 한 줄로 실행합니다.

```bash
npm run build
```

성공하면 `dist/`가 생성됩니다. 이 명령은 콘텐츠 검증, Astro 타입 검사, 정적 빌드, 내부 링크와 초안 사이트맵 노출 검사를 순서대로 수행합니다.

## Cloudflare Pages 배포

이 폴더를 GitHub 또는 GitLab 저장소에 올린 뒤 [Cloudflare Pages의 Git 연동](https://developers.cloudflare.com/pages/get-started/git-integration/)으로 가져옵니다.

Cloudflare 빌드 설정:

| 항목 | 값 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | 저장소의 기본 브랜치(보통 `main`) |
| 환경 변수 `NODE_VERSION` | `22.12.0` |
| 환경 변수 `SITE_URL` | 실제 공개 주소, 예: `https://example.com` |

처음에는 Pages가 제공하는 `*.pages.dev` 주소를 `SITE_URL`로 넣어 확인해도 됩니다. 개인 도메인을 연결한 뒤에는 반드시 `SITE_URL`을 개인 도메인의 HTTPS 주소로 바꾸고 다시 배포하세요. 그래야 canonical, Open Graph URL, `robots.txt`와 `sitemap.xml`이 최종 도메인을 가리킵니다.

개인 도메인은 Pages 프로젝트의 **Custom domains → Set up a domain**에서 연결합니다. Cloudflare에서 DNS를 관리하는 루트 도메인과 외부 DNS의 서브도메인은 설정 방식이 다르므로 [공식 사용자 지정 도메인 안내](https://developers.cloudflare.com/pages/configuration/custom-domains/)를 따라야 합니다.

## 새 글 검토와 발행

초안 파일은 `src/content/articles/` 또는 `src/content/columns/`에 있습니다. 내용을 직접 검토한 뒤 frontmatter를 다음처럼 바꿉니다.

```yaml
publishedAt: 2026-08-20
draft: false
```

발행일은 실제 처음 공개하는 날짜를 사용합니다. 아직 공개하지 않은 초안에 미리 날짜를 만들지 마세요. 중요한 내용을 나중에 다시 확인하고 고쳤을 때만 다음 값을 추가합니다.

```yaml
updatedAt: 2026-09-03
```

발행 전에는 다음을 확인합니다.

- 제목과 서론이 실제 본문 내용을 정확히 설명하는가
- 운영자가 직접 이해하고 책임질 수 있는 문장인가
- 기능·보안 관련 설명이 연결된 공식 자료와 맞는가
- 과장된 결과, 가짜 경험, 검증되지 않은 최신 정보가 없는가
- 체크리스트가 초보자가 그대로 실행할 만큼 구체적인가
- 관련 글 중 아직 초안인 문서는 공개 화면에 링크되지 않는가
- `npm run build`가 오류 없이 끝나는가

## 애드센스 신청 전후

1. 개인 도메인과 HTTPS 연결을 완료합니다.
2. `SITE_URL`을 최종 도메인으로 설정해 재배포합니다.
3. 공개된 모든 글과 정책 페이지를 모바일에서 직접 읽고 오류를 고칩니다.
4. `https://내도메인/robots.txt`와 `/sitemap.xml`이 열리고 최종 도메인을 가리키는지 확인합니다.
5. Google Search Console에 도메인을 등록하고 사이트맵을 제출합니다.
6. [AdSense 사이트 연결 안내](https://support.google.com/adsense/answer/12169212)에 따라 해당 계정 화면에서 제공하는 검증 방법을 적용합니다.
7. 광고 코드는 승인 신청 시점의 AdSense 안내에 따라 별도로 추가합니다. 임의의 게시자 ID나 `ads.txt`를 만들지 마세요.
8. 실제 광고·쿠키 사용 방식이 정해지면 개인정보처리방침을 다시 수정하고, 방문 지역에 따라 동의 관리 플랫폼이 필요한지 확인합니다.

심사 결과는 콘텐츠와 사이트 상태, 계정, 정책 준수 여부에 따라 달라집니다. 글 수만 맞추거나 브랜드처럼 보이게 꾸미는 것만으로 승인이 보장되지는 않습니다.

## 자주 수정하는 위치

| 수정 항목 | 파일 |
| --- | --- |
| 사이트명·소개·이메일·운영자명 | `src/config/site.ts` |
| 메인·서브·배경 색상 | `src/config/site.ts`의 `colors`와 `src/styles/global.css` |
| 카테고리 | `src/data/categories.ts` |
| 일반 글 | `src/content/articles/*.md` |
| 칼럼 | `src/content/columns/*.md` |
| 콘텐츠 스키마·필수 항목 | `src/content.config.ts` |
| 홈 화면 구성 | `src/pages/index.astro` |
| 헤더·푸터 | `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro` |
| 개인정보처리방침·약관·면책 | `src/pages/privacy.astro`, `terms.astro`, `disclaimer.astro` |
| 콘텐츠 자동 검증 | `scripts/validate-content.mjs` |
| 배포 도메인 | Cloudflare의 `SITE_URL` 환경 변수 |

이 프로젝트에는 관리자 UI가 없습니다. Markdown 파일을 고친 뒤 Git에 반영하면 Cloudflare Pages가 다시 빌드하는 방식입니다. 브라우저 저장소 기반의 가짜 관리자 화면보다 실제 공개 데이터와 소스가 일치하고 백업·이력 관리가 쉬운 구조를 택했습니다.

## 주요 폴더

```text
src/
├── components/        공통 헤더, 푸터, 카드, 브레드크럼
├── config/            사이트 운영 정보
├── content/
│   ├── articles/      정보 글 15개
│   └── columns/       운영자 칼럼 3개
├── data/              카테고리 데이터
├── layouts/           공통·글 상세 레이아웃
├── pages/             홈, 목록, 신뢰·정책 페이지, 사이트맵
└── styles/            반응형 디자인 시스템
public/                OG 이미지, 파비콘, Cloudflare 헤더
scripts/               콘텐츠·링크 검증
```

소셜 공유 이미지는 `public/og.png`, 파비콘은 `public/favicon.png`입니다.
