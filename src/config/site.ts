export const siteConfig = {
  name: '디지털 정리실',
  shortName: '정리실',
  tagline: '파일·사진·이메일을 찾기 쉽고 잃지 않게 관리하는 생활 안내서',
  description:
    '복잡한 파일, 사진, 이메일과 계정을 일상에서 다시 찾기 쉬운 구조로 정리하는 초보자용 디지털 생활 가이드입니다.',
  owner: '카일루스',
  ownerBio:
    '복잡한 디지털 자료를 누구나 따라 할 수 있는 작은 정리 원칙으로 바꾸어 기록합니다.',
  email: 'ashtongate1125@gmail.com',
  locale: 'ko_KR',
  language: 'ko',
  colors: {
    primary: '#17324D',
    secondary: '#197874',
    background: '#F7F8F5'
  },
  navigation: [
    { label: '홈', href: '/' },
    { label: '주제별 안내', href: '/categories/' },
    { label: '칼럼', href: '/columns/' },
    { label: '운영자', href: '/author/' },
    { label: '소개', href: '/about/' }
  ]
} as const;

export function absoluteUrl(path = '/', site?: URL) {
  const base = site || new URL(import.meta.env.SITE_URL || 'https://caelus-h.com');
  return new URL(path, base).toString();
}
