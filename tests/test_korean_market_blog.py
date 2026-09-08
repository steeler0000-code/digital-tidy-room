import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "openclaw" / "korean-market-blog" / "korean_market_blog.py"
SPEC = importlib.util.spec_from_file_location("korean_market_blog", MODULE_PATH)
blog = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(blog)


def fixture(kind="foreign_flow", count=3):
    suffix = "foreign-flow" if kind == "foreign_flow" else "weekend-research" if kind == "weekend_research" else "intraday-gainers"
    sources = [
        {"title": f"공식 자료 {index}", "url": f"https://example.com/source-{index}", "accessed": "2026-09-07"}
        for index in range(1, count + 1)
    ]
    stocks = []
    for index in range(1, count + 1):
        stocks.append({
            "rank": index,
            "name": f"검증종목{index}",
            "ticker": f"{index:06d}",
            "market": "KOSPI",
            "security_type": "common_stock",
            "primary_metric": f"{index * 100}억원",
            "reason": "공식 공시와 시장 데이터에서 확인된 종목별 이벤트와 수급 변화가 같은 시점에 나타난 결과입니다. 비교 기간의 거래량과 업종 등락률도 함께 확인했습니다.",
            "evidence": "KRX 집계와 해당 기업의 공식 공시에서 기준일과 핵심 수치를 교차 확인했습니다.",
            "outlook": "단기 주가 흐름의 지속성은 후속 공시, 실적에 미치는 영향, 추가 수급과 거래량이 함께 확인되는지에 따라 달라질 수 있습니다. 현재 확인된 재료가 다음 분기 이익 추정치와 현금흐름에 반영되는지를 추가로 점검해야 합니다.",
            "value_view": "재료 자체보다 이익과 현금흐름에 실제로 반영되는지를 우선 확인합니다.",
            "company_profile": "반도체 장비와 전장 부품을 함께 다루며, 최근에는 신규 수주와 업황 회복 기대가 함께 거론됐습니다.",
            "risks": ["기대가 실적보다 빠르게 선반영됐을 가능성"],
            "source_urls": [sources[index - 1]["url"]],
        })
    return {
        "schema_version": "1.0",
        "article_id": f"2026-09-07-{suffix}",
        "content_type": kind,
        "publication_date": "2026-09-07",
        "session_date": "2026-09-04" if kind in {"foreign_flow", "weekend_research"} else "2026-09-07",
        "as_of": "2026-09-04 장 마감" if kind in {"foreign_flow", "weekend_research"} else "2026-09-07 12:10 KST",
        "market_open": True,
        "title": "코스피 상위 5개 종목의 핵심 이유와 지속 가능성",
        "subtitle": "검증된 수치와 공식 공시를 중심으로 분석합니다.",
        "executive_summary": "상위 종목의 움직임은 공통 업종 요인과 개별 기업 재료가 섞여 있으며, 단기 수급을 기업가치 변화로 단정하기보다 후속 공시와 실적 흐름을 확인할 필요가 있습니다.",
        "stocks": stocks,
        "synthesis": {
            "classification": "혼합형",
            "analysis": "검증된 종목들은 동일 업종에 완전히 집중되지 않았고 지수 비중과 개별 기업 촉매가 함께 관찰됩니다. 따라서 한 가지 원인으로 일괄 해석하지 않고 종목별 후속 지표를 보아야 합니다.",
            "watch_items": ["후속 공시와 실적 영향", "외국인 순매수와 거래량의 연속성"],
        },
        "tags": ["코스피", "외국인수급", "가치투자"],
        "sources": sources,
        "disclaimer": blog.DISCLAIMER,
        "topic": {"id": "01", "title": "저PBR + 고ROE 진주 찾기", "previous_publication_date": "", "exclude_next": "yes"} if kind == "weekend_research" else None,
    }


class KoreanMarketBlogTests(unittest.TestCase):
    def test_normalize_publishes_only_verified_subset(self):
        article = blog.normalize_article(fixture(count=3), "foreign_flow", "2026-09-07")
        self.assertEqual(len(article["stocks"]), 3)
        self.assertIn("검증된 3개 종목", article["title"])
        self.assertEqual(blog.validate_article(article, "foreign_flow", "2026-09-07"), [])

    def test_foreign_flow_session_date_uses_previous_completed_day(self):
        raw = fixture(count=3)
        raw["publication_date"] = "2026-09-09"
        raw["article_id"] = "2026-09-09-foreign-flow"
        raw["session_date"] = "2026-09-09"
        raw["as_of"] = "2026-09-09T06:50:00+09:00"
        article = blog.normalize_article(raw, "foreign_flow", "2026-09-09")
        self.assertEqual(article["session_date"], "2026-09-08")
        self.assertIn("2026-09-08", article["as_of"])
        self.assertEqual(blog.validate_article(article, "foreign_flow", "2026-09-09"), [])

    def test_render_is_cardless_and_same_source(self):
        article = blog.normalize_article(fixture(kind="intraday_gainers"), "intraday_gainers", "2026-09-07")
        tistory = blog.render_tistory(article)
        naver = blog.render_naver(article)
        plan = blog.render_naver_plan(article)
        self.assertNotRegex(tistory + naver, r"<img|IMAGE:|CHART:")
        self.assertEqual(plan["theme_name"], "navy_institutional")
        self.assertEqual(plan["image_slots"], [])
        self.assertTrue(any(block["type"] == "table" for block in plan["blocks"]))
        self.assertIn('class="stock-snapshot"', tistory)
        self.assertNotIn("<table", tistory)
        self.assertGreaterEqual(tistory.count(article["stocks"][0]["reason"]), 2)
        self.assertEqual(plan["blocks"][0]["text"], "9월 7일 코스피 급등 종목 분석")
        self.assertFalse(any(block["type"] == "link" for block in plan["blocks"]))
        self.assertFalse(any(block.get("label") == "확인한 근거" for block in plan["blocks"]))
        for stock in article["stocks"]:
            self.assertIn(stock["reason"], tistory)
            self.assertIn(stock["reason"], naver)
        self.assertIn("독자님들, ", tistory)
        self.assertIn("독자님들, ", naver)
        self.assertIn("12시 10분", tistory)
        self.assertIn("12시 10분", naver)
        self.assertNotIn("KST", tistory)
        self.assertNotIn("KST", naver)
        self.assertNotIn("[출처]", naver)
        self.assertNotIn("<h2>출처</h2>", tistory)

    def test_naver_adds_company_profile_for_non_kospi100_when_reference_exists(self):
        original = blog.KOSPI100_TICKERS
        with tempfile.TemporaryDirectory() as value:
            try:
                blog.KOSPI100_TICKERS = Path(value) / "kospi100-tickers.json"
                blog.KOSPI100_TICKERS.write_text(json.dumps({"tickers": ["000001"]}, ensure_ascii=False), encoding="utf-8")
                article = blog.normalize_article(fixture(kind="intraday_gainers", count=2), "intraday_gainers", "2026-09-07")
                naver = blog.render_naver(article)
                plan = blog.render_naver_plan(article)
                self.assertNotIn("※ 검증종목1 :", naver)
                self.assertIn("※ 검증종목2 :", naver)
                self.assertTrue(any(block["type"] == "company_profile" and "검증종목2" in block["text"] for block in plan["blocks"]))
            finally:
                blog.KOSPI100_TICKERS = original

    def test_naver_publisher_uses_maruburi_and_large_stock_heading(self):
        source = (blog.PUBLISHERS / "naver_cardless_publish.cjs").read_text(encoding="utf-8")
        self.assertIn("const bodyFont='마루부리'", source)
        self.assertIn("fontFamily:bodyFont", source)
        self.assertIn("fontSizeCode:'fs36'", source)
        self.assertIn("hasLargeStockHeading", source)

    def test_package_targets_only_two_blogs(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            source = root / "fixture.json"
            source.write_text(json.dumps(fixture(), ensure_ascii=False), encoding="utf-8")
            state = blog.generate("foreign_flow", "2026-09-07", root, str(source))
            self.assertEqual(state["targetChannels"], ["tistory", "naver"])
            self.assertFalse(state["cardsEnabled"])
            package = blog.package_dir(root, "2026-09-07", "foreign_flow")
            self.assertFalse((package / "channels" / "instagram").exists())
            self.assertTrue((package / "channels" / "naver" / "plan.json").is_file())
            check = blog.preflight("foreign_flow", "2026-09-07", root, check_login=False)
            self.assertTrue(check["ok"], check)
            for publisher in ("tistory_cardless_publish.cjs", "naver_cardless_publish.cjs"):
                result = subprocess.run(
                    ["node", str(blog.PUBLISHERS / publisher), "--package-dir", str(package), "--dry-run"]
                    if publisher.startswith("tistory")
                    else ["node", str(blog.PUBLISHERS / publisher), "--package-dir", str(package), "--rebuild-editor"],
                    check=False, text=True, capture_output=True,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout)["imageCount"], 0)

    def test_weekend_is_skipped(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            state = blog.generate("foreign_flow", "2026-09-05", root, None)
            self.assertEqual(state["state"], "skipped")
            self.assertEqual(state["reason"], "not_a_weekday")
            self.assertTrue(blog.preflight("foreign_flow", "2026-09-05", root)["ok"])

    def test_weekend_research_runs_only_on_weekend_and_records_topic(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            source = root / "fixture.json"
            source.write_text(json.dumps(fixture(kind="weekend_research"), ensure_ascii=False), encoding="utf-8")
            state = blog.generate("weekend_research", "2026-09-05", root, str(source))
            self.assertEqual(state["state"], "ready")
            self.assertEqual(state["selectedTopic"]["id"], "01")
            package = blog.package_dir(root, "2026-09-05", "weekend_research")
            article = json.loads((package / "article.json").read_text(encoding="utf-8"))
            self.assertEqual(article["article_id"], "2026-09-05-weekend-research")
            self.assertEqual(blog.validate_article(article, "weekend_research", "2026-09-05"), [])
            plan = blog.render_naver_plan(article)
            self.assertEqual(plan["theme_name"], "teal_modern")
            blog.record_weekend_history(root, article, {
                "state": "published",
                "channels": {"tistory": {"url": "https://example.com/t"}, "naver": {"url": "https://example.com/n"}},
            })
            rows = blog.read_weekend_history(root)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["topic_id"], "01")

    def test_weekend_research_skips_weekdays(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            state = blog.generate("weekend_research", "2026-09-07", root, None)
            self.assertEqual(state["state"], "skipped")
            self.assertEqual(state["reason"], "not_weekend")

    def test_market_mismatch_is_blocked_and_snapshot_is_normalized(self):
        article = fixture(kind="intraday_gainers")
        article["stocks"][0]["market"] = "KOSDAQ"
        article["as_of"] = "2026-09-07 12:05 KST"
        normalized = blog.normalize_article(article, "intraday_gainers", "2026-09-07")
        self.assertEqual(normalized["as_of"], "2026-09-07T12:10:00+09:00")
        failures = blog.validate_article(normalized, "intraday_gainers", "2026-09-07")
        self.assertTrue(any("시장/종류" in value for value in failures))
        self.assertFalse(any("12:10" in value for value in failures))

    def test_zero_verified_stocks_is_skipped(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            source = root / "fixture.json"
            source.write_text(json.dumps(fixture(count=0), ensure_ascii=False), encoding="utf-8")
            state = blog.generate("foreign_flow", "2026-09-07", root, str(source))
            self.assertEqual(state["state"], "skipped")
            self.assertEqual(state["reason"], "no_verified_stocks")
            self.assertTrue(blog.preflight("foreign_flow", "2026-09-07", root)["ok"])


if __name__ == "__main__":
    unittest.main()
