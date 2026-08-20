# 예약 발행 운영 기준

- 자동 작업은 매일 오전 9시 5분(KST)에 예약일이 지난 콘텐츠를 확인합니다.
- `draft: true`, `editorialApproved: true`, `scheduledAt: YYYY-MM-DD` 조건을 모두 만족하는 글만 공개합니다.
- 정보 글은 수요일 주 1회, 운영자 칼럼은 월 1회를 기본 간격으로 사용합니다.
- 자동 생성이나 대량 공개는 하지 않습니다. 새 글은 사실 확인과 편집 검토 후에만 `editorialApproved: true`로 바꿉니다.
- 공개 시 사용을 마친 `scheduledAt`은 제거되고 실제 공개일이 `publishedAt`에 기록되며, Git 기록과 Cloudflare 자동 배포가 남습니다.
