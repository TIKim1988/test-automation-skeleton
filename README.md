# 히스토리
| 날짜 | 내용 |
|---|---|
| 260710 | 깃허브 최초 푸시, 비회원기반 스포크 테스트케이스 작성, 테스트 케이스 기반 playwright 구축, 깃허브 액션 스케쥴링 구축 |

# 테스트케이스 <-> 자동화 연동 뼈대

같은 저장소 안에 "테스트케이스 관리" 영역과 "자동화 실행" 영역을 분리해두고,
그 사이를 YAML 하나로 연결하는 구조입니다. 현재는 lomastore.com 실 사이트를 대상으로
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
├── automation/                 자동화 프로젝트 소유
│   ├── runner/
│   │   ├── types.ts            Step/TestCase/SelectorMap 타입
│   │   ├── loader.ts           testcases·selectors·fixtures 로딩 + ${} 템플릿 치환
│   │   ├── selectors.ts        selectors/*.yaml 병합
│   │   ├── interpreter.ts      step -> 실제 Playwright 명령 변환/실행
│   │   └── known-issues.ts     아직 실제 DOM에 없는 testId를 참조하는 테스트를 실패 대신 skip 처리
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
| `testcases/**/*.yaml` | 테스트케이스 관리 | 사람이 읽는 시나리오. 동시에 자동화가 그대로 실행하는 스펙 |
| `selectors/*.yaml` | 테스트케이스 관리 | 화면 요소 이름 -> 실제 셀렉터(role/testId/css) 매핑 |
| `fixtures/*.yaml` | 테스트케이스 관리 | 테스트에 쓰이는 실제 데이터 |
| `automation/runner/*` | 자동화 | YAML을 읽어 Playwright 명령으로 변환하는 인터프리터, known-issues 처리 |
| `automation/steps/custom.ts` | 자동화 | YAML 기본 동작으로 못 담는 복잡한 로직 확장 지점 |
| `automation/tests/*.spec.ts` | 자동화 | 위 인터프리터를 실제로 구동하는 Playwright 테스트 진입점 |

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

## 아직 실제 DOM에 반영 안 된 요소 처리 (known-issues.ts)

테스트케이스 관리 프로젝트가 `selectors/*.yaml`에 testId로 등록해뒀지만 실제 서비스에는
아직 `data-testid`가 없는 요소가 있을 수 있습니다. 이런 요소를 참조하는 테스트는 타임아웃
실패 대신 `automation/runner/known-issues.ts`에 사유와 함께 등록되어 skip 처리됩니다.
프론트엔드에 testId가 실제로 추가되면 그 목록에서 지우면 다시 정상적으로 실행/검증됩니다.

## 테스트케이스 스텝 어휘 (action 종류)

`navigate`, `click`, `fill`, `select`, `check`, `uncheck`,
`assert_visible`, `assert_hidden`, `assert_text`, `wait`, `custom`

## 실행

```bash
npm install
npx playwright install --with-deps chromium   # 최초 1회
npx playwright test                            # lomastore.com 대상, 23개
```

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
| SEARCH-002 | 검색 결과 화면에서 정렬 옵션을 변경할 수 있다 | regression, search |
| SEARCH-003 | 결과가 거의 없을 법한 키워드로 검색해도 검색 결과 화면이 정상적으로 노출된다 | regression, search |

### store/

| ID | 제목 | 태그 |
|---|---|---|
| STORE-001 | 스토어에서 카테고리를 선택하면 해당 카테고리 상품 목록이 노출된다 | smoke, store |
| STORE-002 | 카테고리 상품 목록의 정렬 옵션을 변경할 수 있다 | regression, store |

### product/

| ID | 제목 | 태그 | 비고 |
|---|---|---|---|
| PRODUCT-001 | 상품 상세 페이지에 상품명/수량조절/장바구니담기 버튼이 노출된다 | smoke, product | known-issues.ts로 skip 중 (상품명 testId 미부여) |
| PRODUCT-002 | 상품 상세에서 수량 증가/감소 버튼을 누를 수 있다 | regression, product | known-issues.ts로 skip 중 (수량 표시 testId 미부여) |
| PRODUCT-003 | 장바구니 담기 클릭 시 장바구니에 상품이 추가된다 | smoke, product, cart | |
| PRODUCT-004 | 로그인이 필요한 상품에 비로그인 상태로 접근하면 로그인 안내 화면이 노출된다 | regression, product | |
| PRODUCT-005 | 비로그인 상태에서 찜하기 버튼을 누르면 로그인 화면으로 이동한다 | regression, product | |

### cart/

| ID | 제목 | 태그 |
|---|---|---|
| CART-001 | 장바구니에 담긴 상품과 주문 버튼이 노출된다 | smoke, cart |
| CART-002 | 장바구니에서 수량 증가/감소 버튼을 누를 수 있다 | regression, cart |
| CART-003 | 장바구니 상품 삭제 시 확인 팝업 후 삭제된다 | regression, cart |
| CART-004 | 장바구니를 비우면 빈 장바구니 안내와 이동 버튼이 노출된다 | regression, cart |
| CART-005 | 장바구니 비우기 확인 팝업에서 취소하면 상품이 유지된다 | regression, cart |

### checkout/

| ID | 제목 | 태그 |
|---|---|---|
| CHECKOUT-001 | 비로그인 상태에서도 장바구니의 주문하기를 통해 주문서 화면에 진입할 수 있다 | smoke, checkout |
| CHECKOUT-002 | 주문서 화면에 주문자 정보와 배송지 정보 입력란이 노출되고 입력할 수 있다 | regression, checkout |
| CHECKOUT-003 | 주문서 화면에서 결제 수단을 선택할 수 있다 | regression, checkout |
| CHECKOUT-004 | 주문서 화면에 이용약관/개인정보처리방침 안내가 노출된다 | regression, checkout |
| CHECKOUT-005 | 주문서 작성 후 최종 결제 버튼이 노출된다 (실제 결제는 수행하지 않음) | smoke, checkout |

### order-tracking/

| ID | 제목 | 태그 |
|---|---|---|
| ORDER-001 | 비회원 주문조회 화면에 주문번호/이메일 입력란과 조회 버튼이 노출된다 | regression, order-tracking |
