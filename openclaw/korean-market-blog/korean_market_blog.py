#!/usr/bin/env python3
"""Cardless KOSPI analysis pipeline for Naver and Tistory."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import html
import json
import os
from pathlib import Path
import random
import re
import subprocess
import tempfile
import time
from typing import Any, Iterable
from urllib.parse import urlparse
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUNTIME = Path.home() / ".openclaw" / "workspace" / "contents_chief_director" / "runtime" / "korean-market-blog"
PUBLISHERS = Path(__file__).resolve().parent / "publishers"
KOSPI100_TICKERS = Path(__file__).resolve().parent / "data" / "kospi100-tickers.json"
CAELUS_PIPELINE = Path(os.environ.get("CAELUS_PIPELINE", "/Users/ashton/Documents/AGI system 설계/Caelus-Market-Briefing"))
DISCLAIMER = "본 콘텐츠는 공개 자료를 바탕으로 한 일반 정보이며 특정 종목의 매수·매도 권유가 아닙니다. 투자 판단과 책임은 투자자 본인에게 있습니다."
PROHIBITED = (
    re.compile(r"수익.{0,4}보장"),
    re.compile(r"반드시.{0,8}(매수|매도|상승|하락)"),
    re.compile(r"무조건.{0,8}(매수|매도|상승|하락)"),
    re.compile(r"지금.{0,4}(사야|팔아야)"),
)
KINDS = {"foreign_flow", "intraday_gainers", "weekend_research"}
WEEKEND_TOPICS = [
    {"id": "01", "title": "저PBR + 고ROE 진주 찾기", "instruction": "KOSPI200 중 PBR 1.0배 미만, 최근 3개 회계연도 ROE 10% 이상, 최근 3년 누적 영업현금흐름 플러스, 일회성 이익 왜곡 없음, 최근 12개월 영업이익 급격 악화 없음 조건을 만족하는 기업을 찾고 투자매력도 높은 5개를 순위화하십시오. 금융주는 별도로 평가하십시오."},
    {"id": "02", "title": "기관 수급 반전 종목", "instruction": "KOSPI·KOSDAQ 주요 종목 중 직전 20거래일 누적 기관 순매도에서 최근 5거래일 누적 기관 순매수로 전환된 종목을 찾고, 순매수 금액과 시가총액 대비 순매수 비율을 함께 평가해 가장 강한 3개를 선정하십시오."},
    {"id": "03", "title": "외국인 집중매수 종목", "instruction": "최근 5거래일 외국인 순매수 상위 종목을 분석하되, 단순 금액과 시가총액 대비 순매수 비율을 함께 계산하고 외국인 매수 성격을 분류하십시오."},
    {"id": "04", "title": "시장 관심 급증 종목 심층분석", "instruction": "지난 1주일 동안 투자자 관심이 가장 크게 증가한 한국 주식을 찾고 네이버 금융 인기검색, Google Trends, 커뮤니티 관심도, 뉴스 기사량을 가능한 범위에서 교차검증하십시오."},
    {"id": "05", "title": "유튜브 투자 컨센서스 검증", "instruction": "최근 7일 한국 주식 관련 유튜브 영상 중 조회수 높은 영상 10개를 분석하되 Shorts, 재업로드, 단순 뉴스 복제를 제외하고 많이 긍정 추천된 기업의 펀더멘털과 논리 일치 여부를 검증하십시오."},
    {"id": "06", "title": "주간 최강 업종 대장주 비교", "instruction": "최근 5거래일 상승률이 가장 높은 국내 산업을 찾고 해당 산업 대표기업 2개를 매출, 이익, ROE, FCF, 부채, PER, PBR, EV/EBITDA로 비교하십시오."},
    {"id": "07", "title": "주간 최고 상승주 vs 경쟁사", "instruction": "최근 5거래일 상승률이 가장 높은 한국 주식 중 시가총액 5,000억원 이상, 평균 일거래대금 100억원 이상인 기업을 찾고 직접 경쟁사 3~5개와 비교하십시오."},
    {"id": "08", "title": "EPS 전망 상향 종목", "instruction": "최근 4주 동안 향후 12개월 EPS 전망치가 가장 많이 상향된 KOSPI200 종목을 찾고 상향 원인을 판매량, 가격, 원재료, 비용절감, 수주, 환율, 업황으로 분해하십시오."},
    {"id": "09", "title": "가치함정 탐지", "instruction": "KOSPI200 PER 하위 20% 또는 PBR 하위 20% 기업 중 ROE 하락, 현금흐름 악화, 부채 증가, 매출·이익 감소, EPS 하향, 장기 순매도, 산업 쇠퇴 신호를 조사해 진짜 저평가·턴어라운드·가치함정으로 분류하십시오."},
    {"id": "10", "title": "합리적 가격의 퀄리티 성장주", "instruction": "KOSPI200 중 최근 3년 매출 CAGR 8% 이상, EPS CAGR 10% 이상, ROE 12% 이상, 영업현금흐름 지속 플러스, 부채비율 150% 이하, 향후 12개월 EPS 전망 비하향 기업을 찾고 현재 Forward PER이 최근 5년 평균보다 낮거나 비슷한 기업 5개를 선정하십시오."},
    {"id": "11", "title": "외국인·기관 동시 매수 + 기술적 돌파", "instruction": "최근 10거래일 외국인·기관 누적 순매수 플러스, 거래량 증가, 60일 또는 120일 신고가 돌파 조건을 만족하고 EPS 전망 상향·실적 개선·신규 수주·업황 개선 중 최소 1개 근거가 있는 종목 5개를 선정하십시오."},
    {"id": "12", "title": "종합 스코어 기반 이번 주 TOP 5", "instruction": "KOSPI200 전체를 Value, Quality, Growth, Momentum, Flow 각 20점으로 100점 만점 평가하고 상위 10개 표와 상위 5개 심층 분석을 제시하십시오."},
]


class PipelineError(RuntimeError):
    pass


def now_kst() -> dt.datetime:
    return dt.datetime.now(ZoneInfo("Asia/Seoul"))


def previous_weekday(value: dt.date) -> dt.date:
    previous = value - dt.timedelta(days=1)
    while previous.weekday() >= 5:
        previous -= dt.timedelta(days=1)
    return previous


def runtime_root(value: str | None) -> Path:
    return Path(value or os.environ.get("KOREAN_MARKET_RUNTIME", DEFAULT_RUNTIME)).expanduser().resolve()


def article_suffix(kind: str) -> str:
    if kind == "foreign_flow":
        return "foreign-flow"
    if kind == "intraday_gainers":
        return "intraday-gainers"
    return "weekend-research"


def package_dir(root: Path, publication_date: str, kind: str) -> Path:
    return root / f"{publication_date}-{article_suffix(kind)}"


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temp_name)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PipelineError(f"필수 파일 없음: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineError(f"JSON 형식 오류: {path}: {exc}") from exc


def topic_history_path(root: Path) -> Path:
    return root / "weekend-topic-history.jsonl"


def read_weekend_history(root: Path) -> list[dict[str, Any]]:
    path = topic_history_path(root)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        with contextlib.suppress(json.JSONDecodeError):
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
    return rows


def select_weekend_topic(root: Path, publication_date: str) -> dict[str, str]:
    history = read_weekend_history(root)
    used = {str(row.get("topic_id")) for row in history if row.get("topic_id")}
    all_ids = {topic["id"] for topic in WEEKEND_TOPICS}
    last_topic = str(history[-1].get("topic_id")) if history else None
    publish_date = dt.date.fromisoformat(publication_date)
    recent: set[str] = set()
    for row in history:
        try:
            row_date = dt.date.fromisoformat(str(row.get("publication_date", "")))
        except ValueError:
            continue
        if (publish_date - row_date).days <= 28:
            recent.add(str(row.get("topic_id")))
    candidates = WEEKEND_TOPICS
    if all_ids - used:
        candidates = [topic for topic in candidates if topic["id"] not in used]
    if len(candidates) > 1:
        filtered = [topic for topic in candidates if topic["id"] != last_topic]
        candidates = filtered or candidates
    if len(candidates) > 1:
        filtered = [topic for topic in candidates if topic["id"] not in recent]
        candidates = filtered or candidates
    topic = random.choice(candidates)
    previous_dates = [str(row.get("publication_date")) for row in history if str(row.get("topic_id")) == topic["id"] and row.get("publication_date")]
    return {
        **topic,
        "previous_publication_date": previous_dates[-1] if previous_dates else "",
        "exclude_next": "yes",
    }


def record_weekend_history(root: Path, article: dict[str, Any], state: dict[str, Any]) -> None:
    if article.get("content_type") != "weekend_research" or state.get("state") != "published":
        return
    topic = article.get("topic") if isinstance(article.get("topic"), dict) else {}
    if not topic.get("id"):
        return
    path = topic_history_path(root)
    existing = read_weekend_history(root)
    if any(row.get("article_id") == article.get("article_id") for row in existing):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "published_at": now_kst().isoformat(timespec="seconds"),
        "publication_date": article.get("publication_date"),
        "article_id": article.get("article_id"),
        "topic_id": topic.get("id"),
        "topic_title": topic.get("title"),
        "channels": {name: state.get("channels", {}).get(name, {}).get("url") for name in ("tistory", "naver")},
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


@contextlib.contextmanager
def lock_package(pkg: Path) -> Iterable[None]:
    pkg.mkdir(parents=True, exist_ok=True)
    lock = pkg / ".lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, f"{os.getpid()} {now_kst().isoformat()}\n".encode())
        os.close(fd)
    except FileExistsError as exc:
        raise PipelineError(f"이미 실행 중인 패키지: {pkg.name}") from exc
    try:
        yield
    finally:
        lock.unlink(missing_ok=True)


def extract_json_object(value: str) -> dict[str, Any]:
    """stdout/텍스트에서 최외곽 JSON 객체를 반환한다.

    전체가 JSON 문서면 그대로 사용하고(역순 스캔 금지 — 중첩 meta를 오인할 수 있음),
    아니면 첫 완전한 객체만 추출한다(모델이 JSON 뒤에 텍스트를 붙인 경우 대비).
    """
    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    if start >= 0:
        depth = 0
        in_string = False
        escape = False
        for index in range(start, len(text)):
            ch = text[index]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        parsed = json.loads(text[start : index + 1])
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        pass
                    break
    raise PipelineError("Agent 응답에 JSON 객체가 없습니다")


def _agent_text(envelope: Any) -> str:
    """openclaw agent 응답 envelope에서 최종 어시스턴트 텍스트를 견고하게 추출한다.

    공급자(fallback)별로 envelope 구조가 달라도 동작하도록 여러 형태를 허용한다.
    """
    if isinstance(envelope, dict):
        result = envelope.get("result")
        if isinstance(result, dict):
            payloads = result.get("payloads")
            if isinstance(payloads, list):
                for item in payloads:
                    if isinstance(item, dict) and isinstance(item.get("text"), str) and item["text"].strip():
                        return item["text"]
            for key in ("finalAssistantVisibleText", "finalAssistantRawText", "text", "content"):
                value = result.get(key)
                if isinstance(value, str) and value.strip():
                    return value
        for key in ("finalAssistantVisibleText", "finalAssistantRawText", "text"):
            value = envelope.get(key)
            if isinstance(value, str) and value.strip():
                return value
    raise PipelineError("Agent 응답 envelope 형식 오류")


def openclaw_research(prompt: str, session_key: str, timeout: int = 1500) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md", delete=False) as handle:
        handle.write(prompt)
        prompt_path = Path(handle.name)
    try:
        result = subprocess.run(
            ["openclaw", "agent", "--agent", "market_researcher", "--message-file", str(prompt_path),
             "--session-key", session_key, "--json", "--timeout", str(timeout)],
            check=False, text=True, capture_output=True, timeout=timeout + 30,
        )
    except subprocess.TimeoutExpired as exc:
        raise PipelineError(f"시장 조사 시간 초과({timeout}초)") from exc
    finally:
        prompt_path.unlink(missing_ok=True)
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        raise PipelineError(f"시장 조사 실패: {detail[-1500:]}")
    envelope = extract_json_object(result.stdout)
    text = _agent_text(envelope)
    return extract_json_object(text)


def prompt_for(kind: str, publication_date: str, topic: dict[str, str] | None = None) -> str:
    common = f"""
당신은 머독의 한국증시 전문 조사원입니다. 이 작업은 기존 3이슈 Caelus 브리핑이 아니라 카드 없는 코스피 종목 분석입니다.
publication_date: {publication_date}
current_datetime_kst: {now_kst().isoformat(timespec='seconds')}

필수 운영 규칙:
- web_search와 web_fetch로 실제 최신 자료를 조사하십시오.
- 대상은 KOSPI 보통주만입니다. KOSDAQ, ETF, ETN, SPAC, 우선주, 관리종목은 제외하십시오.
- KRX·DART·기업 공시/IR을 우선하고, 가격·순위 확인에는 기준 시각을 반드시 써주십시오.
- 상위 5개를 임의로 채우지 마십시오. 종목과 핵심 이유를 검증한 경우만 stocks에 넣어 1~5개를 반환하십시오.
- 추정은 추정으로 명시하고 사실, 해석, 전망을 구분하십시오.
- 매수·매도 지시, 수익 보장, 목표가를 쓰지 마십시오.
- 본문에서 미국·일본 등 해외 시장의 등락을 언급할 때는 그 시장이 해당일에 실제 개장했는지 먼저 확인하십시오. 미국 휴장일(노동절 등)이면 "전일 휴장"으로 표기하거나 가장 최근 개장일을 기준일로 명시하고, 휴장일의 등락치를 전일 수치처럼 서술하지 마십시오.
- 파일, Telegram, 브라우저, 게시를 조작하지 마십시오.
- 설명·Markdown fence 없이 아래 형태의 엄격한 JSON 객체 하나만 반환하십시오.

JSON 최상위:
schema_version="1.0", article_id, content_type, publication_date, session_date, as_of, market_open,
title, subtitle, executive_summary, stocks, synthesis, tags, sources, disclaimer.
stocks 항목:
rank, name, ticker(6자리), market="KOSPI", security_type="common_stock", primary_metric,
current_price, previous_close, price_change_amount(가능할 때 숫자), reason(60자 이상), evidence(40자 이상),
outlook(80자 이상), value_view, company_profile(선택: 주요 사업종목과 최근 이슈 1~2문장),
risks(배열), source_urls(배열).
synthesis 항목: classification, analysis(100자 이상), watch_items(2개 이상).
sources 항목: title, url, accessed.
""".strip()
    if kind == "foreign_flow":
        expected_session_date = previous_weekday(dt.date.fromisoformat(publication_date)).isoformat()
        specific = f"""
페르소나: 수급을 신호로 과장하지 않는 외국인 수급 구조 분석가.
직전 완료 거래일에 외국인이 가장 많이 순매수한 코스피 보통주 상위 5개를 조사하십시오.
월요일 발행은 금요일 또는 그보다 이전의 가장 최근 완료 거래일을 사용하십시오.
이 발행의 기본 기준일(session_date)은 직전 완료 KRX 거래일인 {expected_session_date}입니다. publication_date({publication_date}) 당일이나 current_datetime_kst 날짜를 session_date로 쓰지 마십시오.
market_open은 생성 시각(06:50 KST, 개장 전)의 장중 여부가 아니라, 직전 완료 KRX 거래일의 외국인 순매수 데이터를 실제로 확보·검증했는지로 판단해 true/false를 반환하십시오. 데이터가 확인되면 반드시 true로 주고, 휴장·데이터 부재로 조사가 불가능할 때만 false로 주십시오.
각 종목의 순매수액/수량, 시가총액·지수 편입 관계, 업종, 고유 촉매를 비교하고
synthesis.classification을 산업 집중 매수/지수 추종 가능성/종목 선택형 매수/혼합형 중 하나로 정리하십시오.
article_id는 publication_date + "-foreign-flow", content_type은 "foreign_flow"입니다.
""".strip()
    elif kind == "intraday_gainers":
        specific = f"""
페르소나: 주가 급등과 기업가치 변화를 구분하는 보수적 가치투자 리서치 애널리스트.
기준일은 publication_date({publication_date})의 12:10 KST 스냅샷입니다. 토요일 등 과거 날짜 백필 실행에서도
“오늘”이 아니라 반드시 publication_date를 기준일로 사용하고, session_date는 publication_date와 동일하게 반환하십시오.
기준일 거래일 세션의 상승률이 가장 높은 코스피 보통주 상위 5개를 조사하십시오.
각 종목의 12:10 기준 현재가, 전일 종가, 상승 폭 절대금액을 확인 가능할 때 current_price, previous_close,
price_change_amount에 숫자로 넣고, 확인이 불가능하면 해당 필드는 비워 두십시오. 값을 추정해서 채우지 마십시오.
각 종목의 주요 사업종목과 최근 이슈를 1~2문장으로 company_profile에 넣으십시오.
각 상승을 공시·실적·수주·산업 이벤트·수급·테마로 분해하고, 일회성 재료와 기업가치 변화를 구분하십시오.
지속 가능성은 확정적으로 말하지 말고, 이익·현금흐름·밸류에이션·재료 지속성·하방 위험 관점의 확인 조건을 제시하십시오.
종목별 source_urls는 해당 종목 근거의 원본 URL이며, 각 URL을 반드시 최상위 sources 배열에도 함께 넣으십시오.
article_id는 publication_date + "-intraday-gainers", content_type은 "intraday_gainers"입니다.
""".strip()
    else:
        topic = topic or select_weekend_topic(runtime_root(None), publication_date)
        specific = f"""
페르소나: 20년 이상 글로벌 자산운용사에서 한국 주식을 분석·운용한 수석 주식 애널리스트.
이 작업은 토요일·일요일 주말 전용 랜덤 리서치입니다. 선택된 주제를 사용자가 다시 고르게 묻지 말고 즉시 수행하십시오.

선정 주제:
- 주제 번호: {topic['id']}
- 선정 주제: {topic['title']}
- 직전 동일 주제 발행일: {topic.get('previous_publication_date') or '없음'}

주제별 지시:
{topic['instruction']}

공통 분석 원칙:
- 기본적 분석(실적, 성장성, 수익성, 재무건전성, 밸류에이션), 수급 분석(외국인·기관), 기술적 분석(추세·거래량·이동평균·지지·저항), 촉매·리스크 분석을 모두 결합하십시오.
- 긍정 근거와 부정 근거를 모두 제시하고, 근거가 부족한 내용은 반드시 "추정"이라고 표시하십시오.
- PER/PBR이 낮다는 이유만으로 저평가라고 단정하지 말고 ROE 지속성, 현금흐름, EPS 전망, 수급, 재평가 촉매를 함께 검토하십시오.
- KRX, DART, 기업 IR/공식 보도자료, 금융감독원·정부기관, 증권사 컨센서스, 신뢰도 높은 금융정보 서비스, 언론 순서로 신뢰도를 두십시오.
- 최종 질문 "지금 이 가격에서 투자했을 때 예상되는 상승 여력에 비해 감수해야 할 하락 위험이 충분히 작은가?"에 대한 답을 synthesis.analysis 마지막에 포함하십시오.

반환 JSON 추가 조건:
- article_id는 publication_date + "-weekend-research", content_type은 "weekend_research"입니다.
- topic 객체를 반드시 포함하십시오: id, title, previous_publication_date, exclude_next.
- session_date는 분석 기준 데이터의 대표 기준일입니다. 주말이면 가장 최근 완료 거래일 또는 가장 최근 확인 가능한 데이터 기준일을 사용하십시오.
- market_open은 발행 당일 개장 여부가 아니라 충분히 검증 가능한 최신 데이터 확보 여부로 true/false를 반환하십시오.
- stocks에는 선택 주제의 핵심 분석 대상 1~5개만 넣으십시오. 종목이 아닌 업종 비교 주제라도 대표 기업 기준으로 stocks를 구성하십시오.
- primary_metric에는 주제 핵심 수치(예: PBR/ROE, 순매수 비율, EPS 상향률, 스코어 등)를 넣으십시오.
- value_view에는 기본적 분석·밸류에이션 판단을 반드시 포함하십시오.
- risks에는 반대 논리 또는 하방 리스크를 최소 2개 넣으십시오.
- executive_summary 첫 부분에 "선정 주제: {topic['title']}"를 자연스럽게 포함하십시오.
""".strip()
    return common + "\n\n" + specific


def normalize_article(raw: dict[str, Any], kind: str, publication_date: str, topic: dict[str, str] | None = None) -> dict[str, Any]:
    article = dict(raw)
    article["schema_version"] = "1.0"
    article["content_type"] = kind
    article["publication_date"] = publication_date
    article["article_id"] = f"{publication_date}-{article_suffix(kind)}"
    article["disclaimer"] = DISCLAIMER
    if kind == "weekend_research":
        raw_topic = article.get("topic") if isinstance(article.get("topic"), dict) else {}
        chosen = topic or {}
        article["topic"] = {
            "id": str(raw_topic.get("id") or chosen.get("id") or "").zfill(2),
            "title": str(raw_topic.get("title") or chosen.get("title") or "").strip(),
            "previous_publication_date": str(raw_topic.get("previous_publication_date") or chosen.get("previous_publication_date") or "").strip(),
            "exclude_next": str(raw_topic.get("exclude_next") or chosen.get("exclude_next") or "yes").strip(),
        }
    stocks = article.get("stocks") if isinstance(article.get("stocks"), list) else []
    clean: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in stocks:
        if not isinstance(item, dict):
            continue
        ticker = str(item.get("ticker", "")).strip()
        if ticker in seen:
            continue
        item = dict(item)
        item["ticker"] = ticker
        item["rank"] = len(clean) + 1
        item["source_urls"] = list(dict.fromkeys(str(url) for url in item.get("source_urls", []) if str(url).startswith("https://")))
        item["risks"] = [str(value).strip() for value in item.get("risks", []) if str(value).strip()]
        if re.fullmatch(r"\d{6}", ticker) and item["source_urls"]:
            clean.append(item)
            seen.add(ticker)
        if len(clean) == 5:
            break
    article["stocks"] = clean
    article["tags"] = list(dict.fromkeys(str(tag).strip() for tag in article.get("tags", []) if str(tag).strip()))[:10]
    sources = article.get("sources") if isinstance(article.get("sources"), list) else []
    cleaned_sources = [source for source in sources if isinstance(source, dict) and str(source.get("url", "")).startswith("https://")]
    # 종목 근거 URL이 최상위 sources에 빠졌으면 결정적으로 승격해 포함 보장(검증 게이트 유지).
    existing_urls = {str(source.get("url", "")) for source in cleaned_sources}
    used_urls = {url for stock in clean for url in stock.get("source_urls", [])}
    accessed = now_kst().date().isoformat()
    for url in sorted(used_urls - existing_urls):
        host = (urlparse(url).hostname or "출처").removeprefix("www.")
        cleaned_sources.append({"title": f"{host} 근거 자료", "url": url, "accessed": accessed})
    article["sources"] = cleaned_sources
    if kind == "foreign_flow":
        publish_date = dt.date.fromisoformat(publication_date)
        expected_session = previous_weekday(publish_date)
        try:
            session_date = dt.date.fromisoformat(str(article.get("session_date", "")))
        except ValueError:
            session_date = expected_session
        if session_date >= publish_date:
            article["session_date"] = expected_session.isoformat()
            article["as_of"] = f"{expected_session.isoformat()} 장 마감"
    # intraday_gainers는 publication_date 세션의 12:10 KST 스냅샷이므로 기준일·기준시각을 결정적으로 고정한다.
    if kind == "intraday_gainers":
        article["session_date"] = publication_date
        article["as_of"] = f"{publication_date}T12:10:00+09:00"
    count = len(clean)
    if count and count < 5:
        article["title"] = re.sub(r"상위\s*5개(?:\s*종목)?|TOP\s*5(?:\s*종목)?|5개 종목", f"검증된 {count}개 종목", str(article.get("title", "")), flags=re.I)
        article["subtitle"] = f"상위 5개 후보 중 종목과 핵심 이유가 검증된 {count}개만 정리했습니다. " + str(article.get("subtitle", ""))
    return article


def kospi100_tickers() -> set[str] | None:
    if not KOSPI100_TICKERS.exists():
        return None
    data = read_json(KOSPI100_TICKERS)
    values = data.get("tickers", data) if isinstance(data, dict) else data
    if not isinstance(values, list):
        return None
    tickers = {str(value).zfill(6) for value in values if re.fullmatch(r"\d{1,6}", str(value))}
    return tickers or None


def non_kospi100_company_profile(stock: dict[str, Any], tickers: set[str] | None) -> str | None:
    if tickers is None or stock.get("ticker") in tickers:
        return None
    value = str(stock.get("company_profile") or "").strip()
    if not value:
        return None
    value = re.sub(r"\s+", " ", value)
    return f"※ {stock['name']} : {value}"


def article_text(article: dict[str, Any]) -> str:
    parts = [str(article.get(key, "")) for key in ("title", "subtitle", "executive_summary", "disclaimer")]
    for stock in article.get("stocks", []):
        parts.extend(str(stock.get(key, "")) for key in ("name", "primary_metric", "reason", "evidence", "outlook", "value_view"))
        parts.extend(str(value) for value in stock.get("risks", []))
    synthesis = article.get("synthesis", {})
    parts.extend([str(synthesis.get("classification", "")), str(synthesis.get("analysis", "")), *map(str, synthesis.get("watch_items", []))])
    return "\n".join(parts)


def validate_article(article: dict[str, Any], kind: str, publication_date: str) -> list[str]:
    failures: list[str] = []
    required = ("schema_version", "article_id", "content_type", "publication_date", "session_date", "as_of", "market_open", "title", "subtitle", "executive_summary", "stocks", "synthesis", "tags", "sources", "disclaimer")
    failures.extend(f"필수값 누락: {key}" for key in required if article.get(key) in (None, "", []))
    if article.get("content_type") != kind:
        failures.append("content_type 불일치")
    if article.get("publication_date") != publication_date:
        failures.append("publication_date 불일치")
    if article.get("market_open") is not True:
        failures.append("거래일/데이터 확인값 오류")
    try:
        session_date = dt.date.fromisoformat(str(article.get("session_date", "")))
        publish_date = dt.date.fromisoformat(publication_date)
        if kind == "foreign_flow" and session_date >= publish_date:
            failures.append("외국인 순매수 기준일은 발행일 이전 완료 거래일이어야 함")
        if kind == "intraday_gainers" and session_date != publish_date:
            failures.append("상승 종목 기준일은 발행일과 같아야 함")
        if kind == "weekend_research" and session_date > publish_date:
            failures.append("주말 리서치 기준일은 발행일보다 미래일 수 없음")
    except ValueError:
        failures.append("session_date 형식 오류")
    if kind == "intraday_gainers" and "12:10" not in str(article.get("as_of", "")):
        failures.append("상승 종목 기준시각은 12:10 KST여야 함")
    if kind == "weekend_research":
        topic = article.get("topic") if isinstance(article.get("topic"), dict) else {}
        if topic.get("id") not in {value["id"] for value in WEEKEND_TOPICS} or not topic.get("title"):
            failures.append("주말 리서치 주제 메타데이터 누락")
    stocks = article.get("stocks", [])
    if not isinstance(stocks, list) or not 1 <= len(stocks) <= 5:
        failures.append("검증 종목은 1~5개여야 함")
    ranks = []
    for index, stock in enumerate(stocks if isinstance(stocks, list) else [], start=1):
        ranks.append(stock.get("rank"))
        if stock.get("market") != "KOSPI" or stock.get("security_type") != "common_stock":
            failures.append(f"{index}번 종목 대상 시장/종류 오류")
        if not re.fullmatch(r"\d{6}", str(stock.get("ticker", ""))):
            failures.append(f"{index}번 종목 코드 오류")
        if not str(stock.get("name", "")).strip() or not str(stock.get("primary_metric", "")).strip():
            failures.append(f"{index}번 종목 이름/핵심 수치 누락")
        for field, minimum in (("reason", 60), ("evidence", 40), ("outlook", 80)):
            if len(str(stock.get(field, ""))) < minimum:
                failures.append(f"{index}번 종목 {field} 분량 부족")
        if not stock.get("risks") or not stock.get("source_urls"):
            failures.append(f"{index}번 종목 리스크/출처 누락")
    if ranks != list(range(1, len(ranks) + 1)):
        failures.append("종목 순위가 1부터 연속되지 않음")
    if len(str(article.get("executive_summary", ""))) < 80:
        failures.append("핵심 요약 분량 부족")
    synthesis = article.get("synthesis", {})
    if not isinstance(synthesis, dict) or len(str(synthesis.get("analysis", ""))) < 100 or len(synthesis.get("watch_items", [])) < 2:
        failures.append("종합 분석 부족")
    if not 3 <= len(article.get("tags", [])) <= 10:
        failures.append("태그는 3~10개여야 함")
    source_urls: set[str] = set()
    for source in article.get("sources", []):
        if not isinstance(source, dict) or not str(source.get("title", "")).strip() or not str(source.get("accessed", "")).strip():
            failures.append("출처 제목/확인일 누락")
            continue
        url = str(source.get("url", ""))
        if not url.startswith("https://"):
            failures.append("출처 URL은 HTTPS여야 함")
            continue
        source_urls.add(url)
    used_urls = {url for stock in stocks for url in stock.get("source_urls", [])}
    if not used_urls.issubset(source_urls):
        failures.append("종목 근거 URL이 전체 출처 목록에 없음")
    text = article_text(article)
    for pattern in PROHIBITED:
        if pattern.search(text):
            failures.append(f"금지 표현: {pattern.pattern}")
    if re.search(r"\{\{[^}]+\}\}|\b(TODO|TBD)\b|\[SOURCE_NEEDED\]", text, re.I):
        failures.append("미해결 placeholder")
    return failures


def display_date(article: dict[str, Any]) -> str:
    date = dt.date.fromisoformat(str(article["publication_date"]))
    return f"{date.month}월 {date.day}일"


def display_time(article: dict[str, Any]) -> str:
    value = str(article.get("as_of", ""))
    match = re.search(r"T(\d{2}):(\d{2})|(\d{1,2}):(\d{2})", value)
    if not match:
        return value.replace("KST", "").strip()
    hour = int(match.group(1) or match.group(3))
    minute = int(match.group(2) or match.group(4))
    return f"{hour}시 {minute}분"


def display_title(article: dict[str, Any]) -> str:
    if article["content_type"] == "intraday_gainers":
        return f"{display_date(article)} 코스피 급등 종목 분석"
    if article["content_type"] == "weekend_research":
        title = str(article["title"])
        if not title.startswith("[주말 특집 분석]"):
            title = f"[주말 특집 분석] {title}"
        return title
    return str(article["title"])


def public_subtitle(article: dict[str, Any]) -> str:
    if article["content_type"] != "intraday_gainers":
        return str(article["subtitle"])
    return f"({display_time(article)} 기준)"


def public_summary(article: dict[str, Any]) -> str:
    summary = str(article["executive_summary"]).strip()
    if not summary.startswith("독자님들, "):
        summary = "독자님들, " + summary
    return public_text(article, summary)


def public_text(article: dict[str, Any], value: str) -> str:
    if article["content_type"] != "intraday_gainers":
        return value
    value = str(value)
    value = re.sub(r"(?:\d{4}-\d{2}-\d{2}\s*)?12:10\s*KST\s*스냅샷\s*기준\s*KOSPI\s*보통주\s*검증", public_subtitle(article), value, flags=re.I)
    value = re.sub(r"(?:\d{4}-\d{2}-\d{2}\s*)?12:10\s*KST\s*스냅샷", public_subtitle(article), value, flags=re.I)
    value = re.sub(r"(?:\d{4}-\d{2}-\d{2}\s*)?12:10\s*KST\s*기준", "12시 10분 기준", value, flags=re.I)
    value = re.sub(r"(?:\d{4}-\d{2}-\d{2}\s*)?12:10\s*KST", "12시 10분", value, flags=re.I)
    value = value.replace("KST", "").strip()
    replacements = [
        ("1.3%대 상승.", "1.3%대 상승했습니다."),
        ("주간 강세 연장 종목으로 확인.", "주간 강세 연장 종목으로 확인됐습니다."),
        ("기대 선반영으로 판단.", "기대가 선반영된 것으로 판단됩니다."),
        ("기대를 선반영.", "기대를 선반영한 것으로 보입니다."),
        ("테마 매수세로 분석.", "테마 매수세로 분석됩니다."),
        ("(산업 이벤트 및 테마 중심)", "(산업 이벤트 및 테마 중심입니다)"),
        ("(수급 중심)", "(수급 중심입니다)"),
        ("미확인", "확인되지 않았습니다"),
        ("직접 연계되지 않음", "직접 연계되지는 않았습니다"),
        ("달려 있음", "달려 있습니다"),
        ("성격이 강하다", "성격이 강합니다"),
        ("결정될 것이다", "결정될 것으로 보입니다"),
        ("확인됐다", "확인됐습니다"),
        ("확인되었다", "확인됐습니다"),
        ("분석됐다", "분석됐습니다"),
        ("분석되었다", "분석됐습니다"),
        ("판단된다", "판단됩니다"),
        ("보인다", "보입니다"),
        ("요구된다", "필요합니다"),
        ("제시했다", "제시했습니다"),
        ("작용할 수 있음", "작용할 수 있습니다"),
        ("가능성을 배제할 수 없으나", "가능성은 있지만"),
        ("확인 조건으로 제시", "확인 조건으로 보시면 좋겠습니다"),
        ("추정 포함", "추정이 포함됩니다"),
        ("조건으로 제시.", "조건으로 제시했습니다."),
    ]
    for before, after in replacements:
        value = value.replace(before, after)
    if value and not value.endswith((".", "!", "?")):
        if re.search(r"(다|요|니다|습니다|십시오|세요|입니다)\)?$", value) or value.endswith(")"):
            value += "."
        else:
            value += "입니다."
    return value


def public_metric(article: dict[str, Any], value: str) -> str:
    if article["content_type"] != "intraday_gainers":
        return value
    value = re.sub(r"\s*\([^)]*12:10\s*KST[^)]*\)", "", str(value), flags=re.I)
    value = re.sub(r"(?:\d{4}-\d{2}-\d{2}\s*)?12:10\s*KST", "12시 10분", value, flags=re.I)
    return value.replace("KST", "").strip()


def money_won(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return f"{int(round(value)):,}원"
    return None


def naver_metric(article: dict[str, Any], stock: dict[str, Any]) -> str:
    metric = public_metric(article, stock.get("primary_metric", ""))
    current = money_won(stock.get("current_price"))
    change = money_won(stock.get("price_change_amount"))
    if current and change:
        return f"전일 종가비 {metric} (현재가 {current}, +{change})"
    return metric


def naver_tags(tags: list[Any]) -> list[str]:
    aliases = {"KOSPI": "코스피", "intraday_gainers": "급등종목", "weekend_research": "주말리서치", "가치투자": "가치투자"}
    cleaned: list[str] = []
    for raw in tags:
        value = aliases.get(str(raw), str(raw))
        value = re.sub(r"[^0-9A-Za-z가-힣_]", "", value)
        if value and value not in cleaned:
            cleaned.append(value)
    return [f"#{value}" for value in cleaned[:10]]


def template_name(article: dict[str, Any]) -> str:
    return "teal_modern" if article["content_type"] == "weekend_research" else "navy_institutional"


def tistory_palette(article: dict[str, Any]) -> dict[str, str]:
    if template_name(article) == "teal_modern":
        return {"theme": "#0f766e", "accent": "#14b8a6", "soft": "#eefdfb"}
    return {"theme": "#0d2b52", "accent": "#2f6fb0", "soft": "#f3f6fb"}


def conversational_watch_items(article: dict[str, Any]) -> str:
    items = [public_metric(article, item).rstrip(".") for item in article["synthesis"]["watch_items"]]
    if not items:
        return ""
    body = ", ".join(items[:-1]) + (f", 그리고 {items[-1]}" if len(items) > 1 else items[0])
    return f"다음으로는 {body} 같은 항목을 차례로 확인해 보시면 좋겠습니다."


def render_tistory(article: dict[str, Any]) -> str:
    palette = tistory_palette(article)
    theme = palette["theme"]
    accent = palette["accent"]
    soft = palette["soft"]
    parts = [
        f"<style>.murdoch-report{{font-family:'Nanum Gothic',sans-serif;color:#172033;line-height:1.9;word-break:keep-all}}.murdoch-report h1{{color:{theme};font-size:27px}}.murdoch-report h2{{margin-top:42px;padding-bottom:9px;border-bottom:2px solid {accent};color:{theme}}}.murdoch-report h3{{color:{theme};margin-top:30px}}.murdoch-report .meta{{color:#657086}}.murdoch-report .summary{{padding:20px;border-left:5px solid {accent};background:{soft}}}.murdoch-report .stock-snapshot{{display:grid;gap:14px;margin:20px 0}}.murdoch-report .stock-card{{border:1px solid #d9dee7;border-left:5px solid {accent};padding:16px;background:#fff}}.murdoch-report .stock-card__head{{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;color:{theme};font-weight:700}}.murdoch-report .stock-card__rank{{display:inline-flex;min-width:28px;height:28px;align-items:center;justify-content:center;background:{theme};color:white}}.murdoch-report .stock-card__name{{font-size:18px}}.murdoch-report .stock-card dl{{margin:0}}.murdoch-report .stock-card dt{{margin-top:10px;color:{theme};font-weight:700}}.murdoch-report .stock-card dd{{margin:2px 0 0 0}}.murdoch-report aside{{margin-top:38px;color:#657086;font-size:13px}}</style>",
        '<article class="murdoch-report">',
        f"<h1>{html.escape(display_title(article), quote=False)}</h1>",
        f"<p class=\"meta\">{html.escape(public_subtitle(article), quote=False)}</p>",
        f"<div class=\"summary\"><strong>핵심 결론</strong><p>{html.escape(public_summary(article), quote=False)}</p></div>",
    ]
    parts.append('<h2>한눈에 보는 종목</h2><div class="stock-snapshot">')
    for stock in article["stocks"]:
        parts.append(
            "<section class=\"stock-card\">"
            f"<div class=\"stock-card__head\"><span class=\"stock-card__rank\">{stock['rank']}</span>"
            f"<span class=\"stock-card__name\">{html.escape(stock['name'], quote=False)} ({stock['ticker']})</span></div>"
            "<dl>"
            f"<dt>핵심 수치</dt><dd>{html.escape(public_metric(article, stock['primary_metric']), quote=False)}</dd>"
            f"<dt>판단</dt><dd>{html.escape(public_text(article, stock['reason']), quote=False)}</dd>"
            "</dl></section>"
        )
    parts.append("</div>")
    for stock in article["stocks"]:
        parts.extend([
            f"<h2>{stock['rank']}. {html.escape(stock['name'], quote=False)} ({stock['ticker']})</h2>",
            f"<p><strong>핵심 수치:</strong> {html.escape(public_metric(article, stock['primary_metric']), quote=False)}</p>",
            f"<h3>움직임의 이유</h3><p>{html.escape(public_text(article, stock['reason']), quote=False)}</p>",
            f"<h3>지속 가능성</h3><p>{html.escape(public_text(article, stock['outlook']), quote=False)}</p>",
        ])
        if stock.get("value_view"):
            parts.append(f"<h3>가치투자 관점</h3><p>{html.escape(public_text(article, stock['value_view']), quote=False)}</p>")
        parts.append("<h3>리스크</h3><ul>" + "".join(f"<li>{html.escape(public_text(article, risk), quote=False)}</li>" for risk in stock["risks"]) + "</ul>")
    synthesis = article["synthesis"]
    parts.extend([
        "<h2>종합 판단</h2>",
        f"<p><strong>분류:</strong> {html.escape(synthesis['classification'], quote=False)}</p>",
        f"<p>{html.escape(public_text(article, synthesis['analysis']), quote=False)}</p>",
        "<h3>다음 확인 항목</h3><ul>" + "".join(f"<li>{html.escape(public_text(article, item), quote=False)}</li>" for item in synthesis["watch_items"]) + "</ul>",
    ])
    if article["content_type"] == "weekend_research":
        parts.extend([
            "<h2>출처</h2>",
            "<ul>",
        ])
        parts.extend(f"<li><a href=\"{html.escape(str(source['url']), quote=True)}\" target=\"_blank\" rel=\"noopener\">{html.escape(str(source['title']), quote=False)}</a> ({html.escape(str(source['accessed']), quote=False)})</li>" for source in article["sources"][:10])
        parts.append("</ul>")
    parts.extend([
        f"<aside>{html.escape(article['disclaimer'], quote=False)}</aside>",
        "</article>",
    ])
    return "\n".join(parts) + "\n"


def render_naver(article: dict[str, Any]) -> str:
    kospi100 = kospi100_tickers()
    lines = [
        display_title(article), "", public_subtitle(article), "",
        "[핵심 결론]", public_summary(article), "", "[한눈에 보는 종목]",
    ]
    lines.extend(f"{stock['rank']}. {stock['name']} (종목코드 {stock['ticker']}) | {naver_metric(article, stock)}" for stock in article["stocks"])
    for stock in article["stocks"]:
        profile = non_kospi100_company_profile(stock, kospi100)
        lines.extend([
            "", "",
            f"{stock['rank']}. {stock['name']} (종목코드 {stock['ticker']})",
        ])
        if profile:
            lines.append(profile)
        lines.extend([
            "• 핵심 수치", naver_metric(article, stock),
            "• 급등 사유", public_text(article, stock["reason"]),
            "• 지속 가능성", public_text(article, stock["outlook"]),
        ])
        if stock.get("value_view"):
            lines.extend(["• 가치투자 관점", public_text(article, stock["value_view"])])
        lines.extend(["• 리스크", *[f"{index}. {public_text(article, risk)}" for index, risk in enumerate(stock["risks"], start=1)]])
    synthesis = article["synthesis"]
    lines.extend(["", "[종합 판단]", f"분류: {synthesis['classification']}", public_text(article, synthesis["analysis"]), "", conversational_watch_items(article)])
    if article["content_type"] == "weekend_research":
        lines.extend([
            "",
            "[출처]",
            *[f"- {source['title']}: {source['url']} ({source['accessed']})" for source in article["sources"][:10]],
        ])
    lines.extend(["", "---", article["disclaimer"], "", " ".join(naver_tags(article["tags"]))])
    return "\n".join(lines).strip() + "\n"


def render_naver_plan(article: dict[str, Any]) -> dict[str, Any]:
    theme = template_name(article)
    kospi100 = kospi100_tickers()
    blocks: list[dict[str, Any]] = [
        {"type": "title", "text": display_title(article)},
        {"type": "subtitle", "text": public_subtitle(article)},
        {"type": "divider"},
        {"type": "quote", "label": "핵심 결론", "text": public_summary(article)},
        {"type": "table", "label": "한눈에 보는 종목", "headers": ["순위", "종목", "핵심 수치"],
         "rows": [[str(stock["rank"]), f"{stock['name']} (종목코드 {stock['ticker']})", naver_metric(article, stock)] for stock in article["stocks"]]},
    ]
    for stock in article["stocks"]:
        profile = non_kospi100_company_profile(stock, kospi100)
        blocks.extend([
            {"type": "spacer"},
            {"type": "stock_heading", "rank": stock["rank"], "name": stock["name"], "ticker": stock["ticker"]},
        ])
        if profile:
            blocks.append({"type": "company_profile", "text": public_text(article, profile)})
        blocks.extend([
            {"type": "field", "label": "핵심 수치", "text": naver_metric(article, stock)},
            {"type": "field", "label": "급등 사유", "text": public_text(article, stock["reason"])},
            {"type": "field", "label": "지속 가능성", "text": public_text(article, stock["outlook"])},
        ])
        if stock.get("value_view"):
            blocks.append({"type": "field", "label": "가치투자 관점", "text": public_text(article, stock["value_view"])})
        blocks.append({"type": "field_list", "label": "리스크", "items": [public_text(article, risk) for risk in stock["risks"]]})
    synthesis = article["synthesis"]
    blocks.extend([
        {"type": "heading", "text": "종합 판단"},
        {"type": "quote", "label": synthesis["classification"], "text": public_text(article, synthesis["analysis"])},
        {"type": "paragraph", "text": conversational_watch_items(article)},
    ])
    if article["content_type"] == "weekend_research":
        blocks.extend([
            {"type": "heading", "text": "출처"},
            *[{"type": "bullet", "label": str(source["title"]), "text": f"{source['url']} ({source['accessed']})"} for source in article["sources"][:10]],
        ])
    blocks.extend([
        {"type": "disclaimer", "text": article["disclaimer"]},
        {"type": "tags", "items": naver_tags(article["tags"])},
    ])
    return {"spec_version": "1.0", "platform": "naver-smarteditor-one", "theme_name": theme,
            "article_id": article["article_id"], "image_slots": [], "blocks": blocks}


def initial_state(article: dict[str, Any]) -> dict[str, Any]:
    state = {
        "articleId": article["article_id"], "contentType": article["content_type"],
        "publicationDate": article["publication_date"], "state": "ready",
        "asOf": article["as_of"], "targetChannels": ["tistory", "naver"],
        "cardsEnabled": False, "approvalMode": "automatic", "hardQaApplied": False,
        "channels": {name: {"state": "pending", "attempts": 0, "remoteId": None, "url": None, "error": None} for name in ("tistory", "naver")},
        "createdAt": now_kst().isoformat(timespec="seconds"), "updatedAt": now_kst().isoformat(timespec="seconds"),
    }
    if article.get("content_type") == "weekend_research":
        state["selectedTopic"] = article.get("topic")
    return state


def write_package(pkg: Path, article: dict[str, Any]) -> dict[str, Any]:
    for relative in ("channels/tistory", "channels/naver"):
        (pkg / relative).mkdir(parents=True, exist_ok=True)
    atomic_json(pkg / "article.json", article)
    (pkg / "channels" / "tistory" / "post.html").write_text(render_tistory(article), encoding="utf-8")
    (pkg / "channels" / "naver" / "post.md").write_text(render_naver(article), encoding="utf-8")
    atomic_json(pkg / "channels" / "naver" / "plan.json", render_naver_plan(article))
    state = initial_state(article)
    atomic_json(pkg / "state.json", state)
    return state


def generate(kind: str, publication_date: str, root: Path, input_file: str | None = None) -> dict[str, Any]:
    date = dt.date.fromisoformat(publication_date)
    pkg = package_dir(root, publication_date, kind)
    if kind == "weekend_research" and date.weekday() < 5:
        pkg.mkdir(parents=True, exist_ok=True)
        state = {"state": "skipped", "reason": "not_weekend", "publicationDate": publication_date, "contentType": kind}
        atomic_json(pkg / "state.json", state)
        return state
    if kind != "weekend_research" and date.weekday() >= 5:
        pkg.mkdir(parents=True, exist_ok=True)
        state = {"state": "skipped", "reason": "not_a_weekday", "publicationDate": publication_date, "contentType": kind}
        atomic_json(pkg / "state.json", state)
        return state
    with lock_package(pkg):
        if (pkg / "state.json").exists():
            current = read_json(pkg / "state.json")
            if current.get("state") in {"ready", "publishing", "partial_success", "published"}:
                return current
        topic = select_weekend_topic(root, publication_date) if kind == "weekend_research" else None
        raw = read_json(Path(input_file)) if input_file else openclaw_research(
            prompt_for(kind, publication_date, topic),
            f"korean-market-{publication_date}-{article_suffix(kind)}",
        )
        if raw.get("market_open") is False:
            state = {"state": "skipped", "reason": "krx_closed", "publicationDate": publication_date, "contentType": kind}
            atomic_json(pkg / "state.json", state)
            return state
        article = normalize_article(raw, kind, publication_date, topic)
        if article.get("market_open") is True and not article["stocks"]:
            state = {"state": "skipped", "reason": "no_verified_stocks", "publicationDate": publication_date, "contentType": kind}
            atomic_json(pkg / "state.json", state)
            return state
        failures = validate_article(article, kind, publication_date)
        if failures:
            state = {"state": "blocked", "reason": "mechanical_validation_failed", "failures": failures, "publicationDate": publication_date, "contentType": kind}
            atomic_json(pkg / "state.json", state)
            return state
        return write_package(pkg, article)


def preflight(kind: str, publication_date: str, root: Path, check_login: bool = True) -> dict[str, Any]:
    pkg = package_dir(root, publication_date, kind)
    state = read_json(pkg / "state.json")
    if state.get("state") == "skipped":
        return {"ok": True, "state": "skipped", "reason": state.get("reason"), "packageDir": str(pkg)}
    if state.get("state") not in {"ready", "partial_success"}:
        return {"ok": False, "state": state.get("state"), "error": "ready 패키지가 아님", "failures": ["ready 패키지가 아님"]}
    article = read_json(pkg / "article.json")
    failures = validate_article(article, kind, publication_date)
    required = [pkg / "channels" / "tistory" / "post.html", pkg / "channels" / "naver" / "post.md", pkg / "channels" / "naver" / "plan.json"]
    failures.extend(f"렌더링 파일 없음: {path}" for path in required if not path.exists() or not path.stat().st_size)
    login: dict[str, Any] = {}
    if check_login and not failures:
        login_script = CAELUS_PIPELINE / "scripts" / "channel_login.cjs"
        for channel in ("tistory", "naver"):
            result = subprocess.run(["node", str(login_script), "--channel", channel], check=False, text=True, capture_output=True, timeout=240)
            login[channel] = {"ok": result.returncode == 0, "detail": (result.stderr or result.stdout)[-500:]}
            if result.returncode:
                failures.append(f"{channel} 로그인 상태 확인 실패")
    return {"ok": not failures, "failures": failures, "login": login, "packageDir": str(pkg)}


def parse_command_json(result: subprocess.CompletedProcess[str]) -> dict[str, Any]:
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        raise PipelineError(detail[-1200:])
    return extract_json_object(result.stdout)


def publish(kind: str, publication_date: str, root: Path, dry_run: bool = False) -> dict[str, Any]:
    pkg = package_dir(root, publication_date, kind)
    with lock_package(pkg):
        state = read_json(pkg / "state.json")
        if state.get("state") in {"skipped", "blocked", "published"}:
            return state
        check = preflight(kind, publication_date, root, check_login=not dry_run)
        if not check["ok"]:
            state["state"] = "blocked"
            state["error"] = "; ".join(check["failures"])
            state["updatedAt"] = now_kst().isoformat(timespec="seconds")
            atomic_json(pkg / "state.json", state)
            return state
        state["state"] = "publishing"
        atomic_json(pkg / "state.json", state)
        commands = {
            "tistory": ["node", str(PUBLISHERS / "tistory_cardless_publish.cjs"), "--package-dir", str(pkg), *( ["--dry-run"] if dry_run else [] )],
            "naver": ["node", str(PUBLISHERS / "naver_cardless_publish.cjs"), "--package-dir", str(pkg), "--rebuild-editor", *( [] if dry_run else ["--publish"] )],
        }
        for channel in ("tistory", "naver"):
            previous = state["channels"][channel]
            if previous.get("state") == "published":
                continue
            previous["attempts"] = int(previous.get("attempts", 0)) + 1
            previous["lastAttemptAt"] = now_kst().isoformat(timespec="seconds")
            try:
                result = parse_command_json(subprocess.run(commands[channel], check=False, text=True, capture_output=True, timeout=600))
                if dry_run:
                    previous.update({"state": "pending", "error": None, "dryRun": result})
                elif result.get("state") == "published" and result.get("remoteId") and result.get("url"):
                    previous.update({"state": "published", "remoteId": result["remoteId"], "url": result["url"], "error": None})
                else:
                    raise PipelineError(f"게시 결과 검증 실패: {result}")
            except Exception as exc:
                previous.update({"state": "failed", "error": str(exc)[:1000]})
            atomic_json(pkg / "state.json", state)
        if dry_run:
            state["state"] = "ready"
        else:
            channel_states = [state["channels"][name]["state"] for name in ("tistory", "naver")]
            state["state"] = "published" if all(value == "published" for value in channel_states) else "partial_success" if any(value == "published" for value in channel_states) else "blocked"
        state["updatedAt"] = now_kst().isoformat(timespec="seconds")
        atomic_json(pkg / "state.json", state)
        if kind == "weekend_research" and not dry_run and state["state"] == "published":
            article = read_json(pkg / "article.json")
            record_weekend_history(root, article, state)
        return state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("generate", "preflight", "publish", "validate", "render"))
    parser.add_argument("--kind", choices=sorted(KINDS), required=True)
    parser.add_argument("--date", default=now_kst().date().isoformat())
    parser.add_argument("--runtime")
    parser.add_argument("--input")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-login-check", action="store_true")
    args = parser.parse_args()
    root = runtime_root(args.runtime)
    try:
        if args.command == "generate":
            result = generate(args.kind, args.date, root, args.input)
        elif args.command == "preflight":
            result = preflight(args.kind, args.date, root, check_login=not args.no_login_check)
        elif args.command == "publish":
            result = publish(args.kind, args.date, root, dry_run=args.dry_run)
        else:
            pkg = package_dir(root, args.date, args.kind)
            article = read_json(Path(args.input) if args.input else pkg / "article.json")
            article = normalize_article(article, args.kind, args.date)
            failures = validate_article(article, args.kind, args.date)
            if args.command == "render" and not failures:
                result = write_package(pkg, article)
            else:
                result = {"ok": not failures, "failures": failures}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("state") not in {"blocked"} and result.get("ok") is not False else 2
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
