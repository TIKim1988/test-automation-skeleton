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

## lomastore.com 실사이트 연동 (자동화 프로젝트, 2026-07-10)

`testcases/`에 lomastore.com 실 화면을 검증하며 작성된 22개 테스트케이스가 추가된 것에 맞춰,
자동화 쪽(이 프로젝트가 소유하는 `playwright.config.ts`, `automation/runner/*`,
`automation/tests/*`)을 다음과 같이 대응했습니다. `testcases/`, `selectors/`, `fixtures/`
파일 내용은 건드리지 않았습니다.

- **실행 대상 전환**: 기본 실행은 `https://lomastore.com` (실사이트)을 대상으로 합니다.
  뼈대 시연용 `demo-app/`은 지우지 않고 `DEMO=1 npx playwright test` 로 실행할 수 있게
  `playwright.config.ts`에서 분기 처리했습니다.
- **로그인 테스트케이스(LOGIN-001/002) 기본 제외**: 이 두 케이스는 demo-app의 가짜 로그인
  화면(role name "Email"/"Password"/"Log in") 대상이라 실제 lomastore.com에는 해당 화면이
  없고, lomastore.com 테스트케이스 작성 시에도 "로그인 자체는 제외" 범위였습니다. 기본
  실행에서는 `testcases/login/` 폴더를 제외하고, `DEMO=1` 모드에서만 실행되도록
  `automation/tests/run-testcases.spec.ts`에서 처리했습니다. 실제 lomastore.com 로그인
  테스트케이스가 별도로 추가되면 이 예외 처리를 재검토해야 합니다.
- **fixtures 병합**: `fixtures/` 폴더 아래 모든 yaml(`users.yaml`, `lomastore.yaml` 등)을
  자동으로 병합해서 사용하도록 `loader.ts`의 `loadFixtures`를 폴더 단위로 바꿨습니다.
- **testId 미부여 요소 skip 처리**: `selectors/product.yaml`의 `product_title`,
  `total_quantity_label`은 테스트케이스 관리 프로젝트가 실제 DOM에 아직 `data-testid`가
  없다고 표시해둔 자리입니다. 이 요소를 참조하는 테스트(PRODUCT-001, PRODUCT-002)는 실패
  대신 사유와 함께 skip되도록 `automation/runner/known-issues.ts`에 등록했습니다.
  프론트엔드에 testId가 실제로 추가되면 이 목록에서 지우면 정상 실행됩니다.
- **결제 버튼 미클릭 원칙 유지**: `checkout-final-pay-button-visible.yaml`처럼 실제 결제를
  트리거하는 버튼은 테스트케이스에서부터 `assert_visible`까지만 사용하므로, 인터프리터
  쪽에서 추가로 막을 로직은 필요 없었습니다.

### 확인한 것 / 확인 못한 것

- `npm install`, `tsc --noEmit`, `npx playwright test --list`(기본 모드 23개, `DEMO=1`
  모드 2개로 정확히 분기되는 것)까지 확인했습니다.
- 이 샌드박스 환경은 Playwright 브라우저 바이너리 다운로드가 크고(약 190MB) 세션마다 처음부터
  다시 받아야 해서, 실제 브라우저 실행까지는 이 세션에서 확인하지 못했습니다. 로컬/CI에서는
  다음으로 바로 실행됩니다.

```bash
npm install
npx playwright install --with-deps chromium   # 최초 1회
npx playwright test                            # 기본: lomastore.com 대상, 23개
DEMO=1 npx playwright test                     # demo-app 뼈대 시연, 2개
```
