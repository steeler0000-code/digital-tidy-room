# Murdoch Korean Market Blog

카드 없이 네이버·티스토리에만 게재하는 한국증시 자동 분석 파이프라인입니다.

- `foreign_flow`: 직전 거래일 외국인 순매수 상위 코스피 보통주, 08:00 발행
- `intraday_gainers`: 12:10 스냅샷 기준 상승률 상위 코스피 보통주, 12:30 발행
- `weekend_research`: 토요일·일요일마다 12개 한국주식 리서치 주제 중 하나를 이력 기반으로 랜덤 선정해 Naver·Tistory에 발행

공통 원본은 `article.json`이며 플랫폼별 문장을 LLM으로 다시 쓰지 않습니다. 티스토리는 반응형 HTML fragment, 네이버는 카드 없는 SmartEditor 블록 계획(`plan.json`)으로 결정적으로 변환합니다. 주중 글(`foreign_flow`, `intraday_gainers`)은 `navy_institutional`, 주말 글(`weekend_research`)은 `teal_modern` 템플릿을 사용합니다. 기존 Caelus Hard QA는 호출하지 않고, 필수값·출처·중복·금지 표현·게시 URL을 확인하는 기계적 검사만 유지합니다.

## 주말 랜덤 리서치

`weekend_research`는 토요일과 일요일에만 생성됩니다. 발행 시점마다 12개 후보 주제 중 하나를 랜덤으로 고르되, 런타임의 `weekend-topic-history.jsonl`을 참고해 직전 주제 반복을 피하고, 가능하면 최근 4주 이내 발행 주제와 이미 사용한 주제를 제외합니다. 12개 주제를 모두 사용하면 다시 전체 후보를 대상으로 순환합니다.

주제 메타데이터는 `article.json`의 `topic`과 `state.json`의 `selectedTopic`에 저장되며, 양 채널 발행이 모두 성공하면 `weekend-topic-history.jsonl`에 append-only로 기록됩니다.

## KOSPI100 기업설명

장중 상승주 Naver 본문은 `openclaw/korean-market-blog/data/kospi100-tickers.json`가 있을 때만 KOSPI100 편입 여부를 판별합니다.

```json
{
  "asOf": "YYYY-MM-DD",
  "source": "KRX 정보데이터시스템 KOSPI100 구성종목",
  "tickers": ["005930", "000660"]
}
```

파일이 없거나 비어 있으면 임의로 비편입 종목을 추정하지 않으며, 기업설명 블록도 공개 본문에 넣지 않습니다. 운영 갱신 기준은 KRX 정보데이터시스템의 KOSPI100 구성종목이며, 정기 리밸런싱 또는 KRX 공지 후 이 파일을 갱신합니다.

기존 마켓브리핑은 `CAELUS_TARGET_CHANNELS=site`, `CAELUS_CARDS_ENABLED=0`으로만 실행합니다. 카드·Instagram을 언급하는 기존 Telegram 검토창은 자동 발행 모드에서 사용하지 않습니다.

```bash
python3 openclaw/korean-market-blog/korean_market_blog.py generate --kind foreign_flow
python3 openclaw/korean-market-blog/korean_market_blog.py preflight --kind foreign_flow
python3 openclaw/korean-market-blog/korean_market_blog.py publish --kind foreign_flow
python3 openclaw/korean-market-blog/korean_market_blog.py generate --kind weekend_research
python3 openclaw/korean-market-blog/korean_market_blog.py publish --kind weekend_research
```

테스트와 예약 전환은 루트의 `openclaw/install_korean_market_blog.py`를 사용합니다. 원복은 `python3 openclaw/install_korean_market_blog.py rollback`입니다.
