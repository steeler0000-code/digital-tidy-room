export type GuideCategory = { slug: 'market-signals' | 'global-investing' | 'etf-structure' | 'company-analysis'; name: string; description: string; accent: string };
export const guideCategories: GuideCategory[] = [
  { slug: 'market-signals', name: '시장 신호 읽기', description: '금리·물가·AI 투자 사이클이 자산 가격에 전달되는 경로를 읽습니다.', accent: '#DCE7FA' },
  { slug: 'global-investing', name: '글로벌 투자', description: '한국 투자자가 환율과 해외 지표를 수익률에 연결하는 방법을 다룹니다.', accent: '#E0EDEA' },
  { slug: 'etf-structure', name: 'ETF 구조', description: '테마·커버드콜·레버리지 상품의 구조와 비용을 상품명 너머에서 확인합니다.', accent: '#EEE7D8' },
  { slug: 'company-analysis', name: '기업과 공시', description: '실적, 현금흐름, 주주환원과 공시를 실행 여부 중심으로 점검합니다.', accent: '#E9E3F2' }
];
export function getGuideCategory(slug: string) { return guideCategories.find((category) => category.slug === slug); }
