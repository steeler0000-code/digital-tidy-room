export type Category = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  accent: string;
  number: string;
};

export const categories: Category[] = [
  {
    slug: 'files-folders',
    name: '파일과 폴더',
    shortDescription: '꺼내 쓰기 쉬운 저장 구조 만들기',
    description:
      '폴더 수를 무작정 늘리지 않고 파일의 이름, 위치, 보관 기간을 일관된 기준으로 정리하는 방법을 다룹니다.',
    accent: '#DDE9E7',
    number: '01'
  },
  {
    slug: 'photos-media',
    name: '사진과 영상',
    shortDescription: '추억을 잃지 않는 정리와 백업',
    description:
      '스마트폰 사진과 영상의 분류, 중복 정리, 원본 보관과 공유를 안전한 순서로 설명합니다.',
    accent: '#E8E2D6',
    number: '02'
  },
  {
    slug: 'email-web',
    name: '이메일과 브라우저',
    shortDescription: '받은 정보가 쌓이지 않는 흐름 만들기',
    description:
      '받은편지함, 뉴스레터와 북마크를 필요한 순간 다시 찾을 수 있도록 관리하는 실용적인 기준을 소개합니다.',
    accent: '#E1E7F0',
    number: '03'
  },
  {
    slug: 'backup-accounts',
    name: '백업과 계정',
    shortDescription: '잃어버리기 전에 대비하는 기본기',
    description:
      '동기화와 백업의 차이, 개인용 백업 설계, 비밀번호 관리자와 2단계 인증의 역할을 차근차근 살펴봅니다.',
    accent: '#E9E1EC',
    number: '04'
  },
  {
    slug: 'digital-habits',
    name: '디지털 생활 습관',
    shortDescription: '정리가 오래 유지되는 작은 루틴',
    description:
      '알림, 기기 교체, 정기 점검처럼 한 번의 정리보다 오래 효과가 이어지는 생활 습관을 정리합니다.',
    accent: '#E5EAD9',
    number: '05'
  }
];

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}
