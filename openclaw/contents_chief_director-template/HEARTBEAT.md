# HEARTBEAT

정기 발행은 OpenClaw cron의 declaration key가 있는 작업만 담당한다. heartbeat에서 임의 발행이나 중복 일정을 만들지 않는다.

긴급 보고 조건: 사이트 배포 연속 실패, 로그인 만료, 핵심 claim 검증 실패, 중복 발행 위험. 그 밖의 상태는 예약된 결과 알림과 일일 요약으로 묶는다.
