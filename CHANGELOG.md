# Changelog

이 파일에는 사용자에게 의미 있는 테스트 운영 변경만 기록합니다. 단순 포맷 변경이나 내부 리팩터링은 커밋 메시지로만 관리합니다.

## Unreleased

### Changed

- 테스트케이스 원본을 스프레드시트 친화적 CSV(`testcase-management/`)로 관리하고, 실행용 YAML을 검증·생성하는 흐름을 추가했습니다.
- 매일 한국 시간 09:00에는 smoke 테스트만 실행하고, regression/all은 GitHub Actions 수동 실행으로 분리했습니다.
- 이메일 리포트에 통과·실패·스킵 수와 실패 요약 첨부파일을 추가했습니다.

### Security

- GitHub Personal Access Token은 저장소·문서·대화에 공유하지 않습니다. 노출된 토큰은 즉시 폐기하고, 최소 권한·만료일을 적용한 새 토큰으로 교체해야 합니다.
