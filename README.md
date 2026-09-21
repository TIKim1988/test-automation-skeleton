> 2026-09-21 main 통합: 전체 29개 TC를 유지하고 예약 실행은 smoke 11개, 수동 회귀는 18개로 구분해. 실행 브랜치와 커밋은 Actions 요약과 메일에 표시해.
> 홈 추가 6개와 환경변수, 화면 요소 기록 기능을 보존했고, 현재 숫자 애니메이션 표시를 반영했어. 과거 검증 수치는 해당 날짜 기록으로 봐야 해.

> 최종 로컬 smoke는 10/11 통과, 전체 실행은 26/29 통과야. 약관 이동 1개와 가격 정렬 2개 실패가 남아 있어.

> 재설계 구현과 날짜별 검증 현황은 [test-health.md](test-health.md)를 참고해.

# 히스토리
| 날짜 | 내용 |
|---|---|
| 260710 | 깃허브 최초 푸시, 비회원기반 스포크 테스트케이스 작성, 테스트 케이스 기반 playwright 구축, 깃허브 액션 스케쥴링 구축 |

# 테스트케이스 <-> 자동화 연동 뼈대

같은 저장소 안에 "테스트케이스 관리" 영역과 "자동화 실행" 영역을 분리해두고,
스프레드시트 친화적인 CSV 원본에서 실행용 YAML을 생성하는 구조입니다. 현재는 lomastore.com 실 사이트를 대상으로
한 테스트케이스/자동화가 실제로 구축되어 있습니다.

## 폴더 구조

```
.
├── testcases/                 사람이 읽는 시나리오 (자동화가 그대로 실행하는 스펙이기도 함)
│   ├── home/
│   ├── search/
│   ├── store/
│   ├── product/
│   ├── cart/
│   ├── checkout/
│   └── order-tracking/
├── selectors/                 화면 요소 이름 -> 실제 role/testId/css 매핑 (화면 단위 파일 분리)
│   ├── home.yaml, search.yaml, store.yaml, product.yaml
│   ├── cart.yaml, checkout.yaml, order-tracking.yaml
│   ├── signin.yaml            비로그인 접근 시 로그인 화면 리다이렉트 확인용 (로그인 시나리오 자체는 범위 밖)
│   └── product_pages.yaml     테스트에 쓰는 대표 상품의 상세 페이지 경로
├── fixtures/
│   └── lomastore.yaml         검색어, 상품 slug, 주문자 정보 등 테스트 데이터
│
├── testcase-management/       테스트케이스 원본(CSV: Excel·Google Sheets에서 편집 가능)
│   ├── test-cases.csv         시나리오 메타데이터
│   └── steps.csv              실행 스텝
│
├── automation/                 자동화 프로젝트 소유
│   ├── runner/
│   │   ├── types.ts            Step/TestCase/SelectorMap 타입
│   │   ├── loader.ts           testcases·selectors·fixtures 로딩 + ${} 템플릿 치환
│   │   ├── selectors.ts        selectors/*.yaml 병합
│   │   ├── interpreter.ts      step -> 실제 Playwright 명령 변환/실행
│   │   └── known-issues.ts     기존 skip 목록 제거, 상태는 CSV에서 관리
│   ├── steps/custom.ts         YAML 기본 action으로 못 담는 로직 확장 지점
│   └── tests/run-testcases.spec.ts   testcases/를 읽어 실행하는 진입점
│
├── playwright.config.ts        baseURL: https://lomastore.com
├── package.json / package-lock.json
└── tsconfig.json
```

## 역할 분담

| 경로 | 소유 프로젝트 | 역할 |
|---|---|---|
| `testcase-management/*.csv` | 테스트케이스 관리 | Excel·Google Sheets에서 편집하는 테스트케이스 원본 |
| `testcases/**/*.yaml` | 자동 생성물 | CSV 원본에서 생성되는, 자동화가 실행하는 스펙 |
| `selectors/*.yaml` | 테스트케이스 관리 | 화면 요소 이름 -> 실제 셀렉터(role/testId/css) 매핑 |
| `fixtures/*.yaml` | 테스트케이스 관리 | 테스트에 쓰이는 실제 데이터 |
| `automation/runner/*` | 자동화 | YAML을 읽어 Playwright 명령으로 변환하는 인터프리터, CSV 상태 처리 |
| `automation/steps/custom.ts` | 자동화 | YAML 기본 동작으로 못 담는 복잡한 로직 확장 지점 |
| `automation/tests/*.spec.ts` | 자동화 | 위 인터프리터를 실제로 구동하는 Playwright 테스트 진입점 |

## 테스트케이스 편집

`testcase-management/test-cases.csv`, `testcase-management/steps.csv`를 Excel 또는 Google Sheets로 열어 수정합니다. CSV 원본을 저장소에 다시 반영한 뒤 아래 명령으로 실행 YAML을 생성합니다.

```bash
npm run testcases:import
npm run testcases:check
```

자세한 열 정의와 편집 규칙은 [testcase-management/README.md](testcase-management/README.md)를 참고하세요.

## 핵심 아이디어

테스트 스텝(`testcases/`)은 화면 요소를 `login_submit_button`, `add_to_cart_button` 같은
**의미 이름**으로만 참조합니다. 그 이름이 실제로 어떤 role/testId/CSS인지는 `selectors/`에
따로 정의합니다.

그래서 UI가 바뀌었을 때:
- 버튼 클래스명, DOM 구조가 바뀐 정도 -> `selectors/*.yaml` 한 줄만 수정. 테스트케이스와 자동화 코드는 그대로.
- 화면 플로우 자체가 바뀜 -> 해당 `testcases/*.yaml`의 `steps` 배열만 수정.
- Playwright API로 표현하기 애매한 복잡한 로직(파일 업로드, 여러 탭 등) -> `automation/steps/custom.ts`에
  이름을 등록하고, 테스트케이스에서는 `action: custom` + `name`으로 호출.

세 경우 모두 "자동화 러너 코드(`interpreter.ts`)"는 건드릴 필요가 없습니다.

## 실행 상태와 실패 처리

CSV의 `status`가 실행 상태의 기준이야. `manual`과 `enabled: false`는 제외하고,
`quarantine`은 일반 실행에서 skip으로 보고해. `npm run test:quarantine`으로 격리된 TC만 재검증해.
현재 29개는 모두 active이고 PRODUCT-001, PRODUCT-002의 하드코딩 skip은 제거했어.
P1 skip, 전체 skip, 빈 실행, 재시도 통과, 실행 오류는 정상 성공으로 집계하지 않아.

## 테스트케이스 스텝 어휘 (action 종류)

`navigate`, `click`, `fill`, `select`, `check`, `uncheck`,
`assert_visible`, `assert_hidden`, `assert_text`, `assert_value`, `assert_checked`,
`assert_unchecked`, `assert_attribute`, `assert_url`, `assert_enabled`, `assert_disabled`, `wait`, `custom`

## 실행

```bash
npm install
npx playwright install --with-deps chromium   # 최초 1회
npm run check                                 # 타입, CSV, 단위 테스트
npx playwright test                            # lomastore.com 대상, 29개
npm run report:summary                        # 실패 또는 flaky가 있으면 비정상 종료
npm run test:smoke                             # 매일 실행하는 핵심 11개
npm run test:regression                        # 회귀 테스트만 수동 실행
```

GitHub Actions는 매일 한국 시간 09:00에 smoke만 실행합니다. regression/all은 Actions의 **Run workflow**에서 선택해 실행합니다.

로그인 자체는 현재 스코프에서 제외되어 있습니다 (`selectors/signin.yaml` 참고 — 비로그인
상태에서 인증이 필요한 동작을 했을 때 로그인 화면으로 정상 리다이렉트되는지만 확인). 실제
로그인 시나리오가 필요해지면 테스트케이스 관리 프로젝트에서 별도로 추가합니다.

결제(실제 결제 트리거) 버튼은 테스트케이스에서부터 `assert_visible`까지만 사용하고 클릭하지
않는 원칙을 유지합니다 (`checkout-final-pay-button-visible.yaml` 참고).

## 두 프로젝트로 쪼갤 때

지금은 한 저장소에 다 들어있지만, 실제로 "테스트케이스 관리" repo와 "자동화" repo를 분리하고
싶다면 `testcases/`, `selectors/`, `fixtures/`를 git submodule이나 서브트리로 자동화 repo에
포함시키면 됩니다. 자동화 쪽 러너 코드는 경로만 알면 되므로 구조 변경이 거의 없습니다.

## 테스트케이스 전체 목록 (23개)

### home/

| ID | 제목 | 태그 |
|---|---|---|
| HOME-001 | 홈페이지 접속 시 헤더 내비게이션과 인기상품 영역이 노출된다 | smoke, home |
| HOME-002 | 인기상품 영역의 카테고리 탭을 클릭해도 에러 없이 전환된다 | regression, home |

### search/

| ID | 제목 | 태그 |
|---|---|---|
| SEARCH-001 | 검색창에 키워드를 입력해 검색하면 검색 결과 화면이 노출된다 | smoke, search |
| SEARCH-002 | 검색 상품의 표시 판매가가 낮은가격순과 높은가격순으로 정렬된다 | regression, search |
| SEARCH-003 | 검색 결과 0건이면 결과 없음 안내와 빈 상품 목록이 표시된다 | regression, search |

### store/

| ID | 제목 | 태그 |
|---|---|---|
| STORE-001 | 스토어에서 카테고리를 선택하면 해당 카테고리 상품 목록이 노출된다 | smoke, store |
| STORE-002 | 카테고리 상품의 표시 판매가가 가격낮은순과 가격높은순으로 정렬된다 | regression, store |

### product/

| ID | 제목 | 태그 | 비고 |
|---|---|---|---|
| PRODUCT-001 | 상품 상세 페이지에 상품명/수량조절/장바구니담기 버튼이 노출된다 | smoke, product | active, 실제 상품명 확인 |
| PRODUCT-002 | 상품 상세 수량 1→2→1 변경에 따라 합계 금액이 일치한다 | regression, product | active, 수량과 금액 확인 |
| PRODUCT-003 | 장바구니 담기 클릭 시 장바구니에 상품이 추가된다 | smoke, product, cart | |
| PRODUCT-004 | 로그인이 필요한 상품에 비로그인 상태로 접근하면 로그인 안내 화면이 노출된다 | regression, product | |
| PRODUCT-005 | 비로그인 상태에서 찜하기 버튼을 누르면 로그인 화면으로 이동한다 | regression, product | |

### cart/

| ID | 제목 | 태그 |
|---|---|---|
| CART-001 | 장바구니에 담긴 상품과 주문 버튼이 노출된다 | smoke, cart |
| CART-002 | 장바구니 수량 1→2→1 변경과 상품 금액, 새로고침 후 상태가 일치한다 | regression, cart |
| CART-003 | 장바구니 상품 삭제 시 확인 팝업 후 삭제된다 | regression, cart |
| CART-004 | 장바구니를 비우면 빈 장바구니 안내와 이동 버튼이 노출된다 | regression, cart |
| CART-005 | 장바구니 비우기 확인 팝업에서 취소하면 상품이 유지된다 | regression, cart |

### checkout/

| ID | 제목 | 태그 |
|---|---|---|
| CHECKOUT-001 | 비로그인 상태에서도 장바구니의 주문하기를 통해 주문서 화면에 진입할 수 있다 | smoke, checkout |
| CHECKOUT-002 | 주문자와 수령자에 서로 다른 값을 입력하면 각각 유지된다 | regression, checkout |
| CHECKOUT-003 | 주문서 화면에서 결제 수단을 선택할 수 있다 | regression, checkout |
| CHECKOUT-004 | 주문서 화면에 이용약관/개인정보처리방침 안내가 노출된다 | regression, checkout |
| CHECKOUT-005 | 주문서 작성 후 최종 결제 버튼이 노출된다 (실제 결제는 수행하지 않음) | smoke, checkout |

### order-tracking/

| ID | 제목 | 태그 |
|---|---|---|
| ORDER-001 | 비회원 주문조회 화면에 주문번호/이메일 입력란과 조회 버튼이 노출된다 | regression, order-tracking |
