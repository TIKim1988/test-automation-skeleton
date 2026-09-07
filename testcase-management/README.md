# 스프레드시트 기반 테스트케이스 관리

`test-cases.csv`와 `steps.csv`가 테스트케이스의 원본입니다. 두 파일은 Excel 또는 Google Sheets로 열어 편집할 수 있으며, Git diff로도 변경 내용을 검토할 수 있습니다.

## 편집 순서

1. 두 CSV 파일을 같은 스프레드시트 문서의 `TestCases`, `Steps` 시트로 각각 가져옵니다.
2. TestCases에서는 시나리오의 메타데이터를, Steps에서는 실행 순서와 동작을 수정합니다.
3. 각 시트를 같은 이름의 CSV로 내보내 이 폴더에 덮어씁니다.
4. `npm run testcases:import`로 실행용 YAML을 생성합니다.
5. `npm run check && npm test`로 검증합니다.

## TestCases 열

| 열 | 설명 |
|---|---|
| `id` | 고유 테스트 ID. 예: `SEARCH-001` |
| `title` | 사람이 읽는 테스트 제목 |
| `path` | 생성할 YAML 경로. 예: `search/search-with-results.yaml` |
| `tags` | 쉼표로 구분. `smoke`, `regression`, 기능 태그 사용 |
| `priority` | `P1`, `P2`, `P3` |
| `status` | `active`, `quarantine`, `manual` |
| `enabled` | `true`일 때만 자동 실행 |
| `precondition` | 테스트 전제조건 |
| `last_verified` | 마지막 확인 날짜 (`YYYY-MM-DD`) |

## Steps 열

`step_no`는 각 `testcase_id` 안에서 1부터 연속되어야 합니다. `target`은 `selectors/`에 등록된 이름만 사용할 수 있습니다. 지원 action은 `navigate`, `click`, `fill`, `select`, `check`, `uncheck`, `assert_visible`, `assert_hidden`, `assert_text`, `assert_value`, `assert_checked`, `assert_unchecked`, `assert_attribute`, `assert_url`, `assert_enabled`, `assert_disabled`, `wait`, `custom`입니다.

템플릿 변수는 기존처럼 `${search.keyword_with_results}` 형식으로 `fixtures/`를 참조합니다.

셀렉터 중복 키, scope 순환, fixture 오타, 중복 YAML 경로, 미등록 custom step은 생성 전에 차단해. `last_verified`는 마지막 통과일이며 실패 기록은 `test-health.md`에서 관리해.
