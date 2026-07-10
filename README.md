# 테스트케이스 <-> 자동화 연동 뼈대

같은 저장소 안에 "테스트케이스 관리" 영역과 "자동화 실행" 영역을 분리해두고,
그 사이를 YAML 하나로 연결하는 구조입니다.

## 폴더 구조와 역할 분담

| 경로 | 소유 프로젝트 | 역할 |
|---|---|---|
| `testcases/**/*.yaml` | 테스트케이스 관리 | 사람이 읽는 시나리오. 동시에 자동화가 그대로 실행하는 스펙 |
| `selectors/*.yaml` | 테스트케이스 관리 | 화면 요소 이름 -> 실제 셀렉터(role/testId/css) 매핑 |
| `fixtures/*.yaml` | 테스트케이스 관리 | 테스트에 쓰이는 실제 데이터(계정 등) |
| `automation/runner/*` | 자동화 | YAML을 읽어 Playwright 명령으로 변환하는 인터프리터 |
| `automation/steps/custom.ts` | 자동화 | YAML 기본 동작으로 못 담는 복잡한 로직 확장 지점 |
| `automation/tests/*.spec.ts` | 자동화 | 위 인터프리터를 실제로 구동하는 Playwright 테스트 진입점 |
| `demo-app/` | - | 이 뼈대를 눈으로 확인하기 위한 가짜 로그인 화면 (실제 프로젝트에선 삭제) |

## 핵심 아이디어

테스트 스텝(`testcases/`)은 화면 요소를 `email_input`, `login_button` 같은 **의미 이름**으로만
참조합니다. 그 이름이 실제로 어떤 role/testId/CSS인지는 `selectors/`에 따로 정의합니다.

그래서 UI가 바뀌었을 때:
- 버튼 클래스명, DOM 구조가 바뀐 정도 -> `selectors/*.yaml` 한 줄만 수정. 테스트케이스와 자동화 코드는 그대로.
- 로그인 절차 자체가 바뀜(2단계 인증 추가 등) -> `testcases/*.yaml`의 `steps` 배열만 수정.
- Playwright API로 표현하기 애매한 복잡한 로직(파일 업로드, 여러 탭 등) -> `automation/steps/custom.ts`에
  이름을 등록하고, 테스트케이스에서는 `action: custom` + `name`으로 호출.

세 경우 모두 "자동화 러너 코드(`interpreter.ts`)"는 건드릴 필요가 없습니다. Claude가 실제 앱을 확인하며
바뀐 부분을 감지했을 때, 대부분 `selectors/*.yaml`이나 `testcases/*.yaml`만 고치면 되도록 설계한 것이 포인트입니다.

## 테스트케이스 스텝 어휘 (action 종류)

`navigate`, `click`, `fill`, `select`, `check`, `uncheck`,
`assert_visible`, `assert_hidden`, `assert_text`, `wait`, `custom`

## 로컬에서 실행해보기

이 사설 샌드박스 환경은 시스템 라이브러리(libXdamage 등)가 없어 브라우저 실행 자체는
확인하지 못했습니다 (YAML 파싱, 셀렉터 매핑, 템플릿 치환 로직과 TypeScript 타입은 검증 완료).
사용자 컴퓨터나 CI에서는 다음 명령으로 바로 동작합니다.

```bash
npm install
npx playwright install --with-deps chromium   # 최초 1회
npx playwright test
```

`demo-app/`은 데모용 가짜 화면입니다. 실제 프로젝트에서는 `playwright.config.ts`의
`baseURL`과 `webServer`를 실제 앱 주소로 바꾸고 이 폴더는 지우면 됩니다.

## 두 프로젝트로 쪼갤 때

지금은 한 저장소에 다 들어있지만, 실제로 "테스트케이스 관리" repo와 "자동화" repo를 분리하고
싶다면 `testcases/`, `selectors/`, `fixtures/`를 git submodule이나 서브트리로 자동화 repo에
포함시키면 됩니다. 자동화 쪽 러너 코드는 경로만 알면 되므로 구조 변경이 거의 없습니다.
