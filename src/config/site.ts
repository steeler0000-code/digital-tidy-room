export const siteConfig = {
  name: 'Caelus',
  shortName: 'Caelus',
  tagline: '시장 이슈를 투자 판단의 기준으로 바꾸는 경제·투자 안내서',
  description:
    '한국 투자자가 국내·미국 주식, ETF, 금리와 환율을 스스로 해석할 수 있도록 마켓 브리핑과 판단 도구를 제공합니다.',
  owner: '카일루스',
  ownerBio:
    '시장의 숫자와 뉴스를 매수·매도 신호가 아닌, 독자가 스스로 판단할 수 있는 기준으로 정리합니다.',
  email: 'ashtongate1125@gmail.com',
  locale: 'ko_KR',
  language: 'ko',
  colors: {
    primary: '#0B1F3A',
    secondary: '#2563EB',
    background: '#F4F7FB'
  },
  navigation: [
    { label: '홈', href: '/' },
    { label: '마켓 브리핑', href: '/briefings/' },
    { label: '투자 방법론', href: '/guides/' },
    { label: '투자 도구', href: '/tools/' },
    { label: '운영자', href: '/author/' },
    { label: '소개', href: '/about/' }
  ]
} as const;

export function absoluteUrl(path = '/', site?: URL) {
  const base = site || new URL(import.meta.env.SITE_URL || 'https://caelus-h.com');
  return new URL(path, base).toString();
}
