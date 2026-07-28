# 테스트 상태 관리

이 문서는 테스트 실패를 자동화 코드 문제, 셀렉터 노후화, 테스트 데이터 문제, 서비스 결함으로 분류하는 운영 장부입니다. 실패한 테스트를 단순히 skip으로 바꾸지 말고, 아래 항목을 먼저 기록합니다.

## 분류 기준

| 분류 | 의미 | 다음 조치 |
|---|---|---|
| `selector` | DOM 변경·모호한 locator·누락된 test id | `selectors/` 또는 프론트엔드 `data-testid` 수정 |
| `test-data` | 상품·검색어·장바구니 같은 전제 데이터가 불안정 | `fixtures/`와 전제조건 수정 |
| `automation` | runner, wait, state 격리 등 자동화 구현 문제 | `automation/` 수정 |
| `product` | 실제 서비스 동작이 기대와 다름 | 제품 이슈로 등록하고 링크 첨부 |
| `quarantine` | 원인은 알지만 당장 자동 실행에서 분리 | `status: quarantine`, 담당자·만료일 기록 |

## 2026-07-28 smoke 실행 결과

| 테스트 | 분류 | 관찰 내용 | 다음 조치 |
|---|---|---|---|
| `HOME-001` | selector | `스토어` role/name locator가 `로마스토어 회원 혜택`까지 2개와 매칭 | exact name 또는 헤더 영역으로 locator 범위 제한 |
| `SEARCH-001` | selector | 검색 버튼 이후 `상품 검색` textbox가 30초 내 노출되지 않음 | 현재 검색 UI의 열기 동작·accessible name 재확인 |
| `STORE-001` | selector/content | `라이프스타일` 링크를 찾지 못함 | 현재 카테고리명·탭 구조 확인 후 selector 수정 |
| `CART-001` | test-data | 빈 장바구니 상태에서 `상품 주문하기` 버튼을 찾음 | 각 케이스가 상품을 장바구니에 넣는 setup을 독립 수행 |
| `PRODUCT-003` | selector/test-data | 장바구니 추가 후 `상품 주문하기` 버튼이 노출되지 않음 | 상품 추가 성공 기준과 장바구니 이동 selector를 분리 |
| `CHECKOUT-001`, `CHECKOUT-005` | test-data | 전제인 장바구니 주문 버튼을 찾지 못해 30초 timeout | 장바구니 준비 fixture/setup을 공유 custom step으로 구현 |
| `PRODUCT-005`, `SEARCH-002~003`, `CART-002~005`, `CHECKOUT-002~004` | untriaged | 이전 전체 실행에서 실패했으나 이번 smoke 범위 밖 | regression 수동 실행 후 같은 기준으로 분류 |
| `PRODUCT-001`, `PRODUCT-002` | quarantine | 실제 DOM의 `data-testid` 미부여로 known issue skip | 프론트엔드 test id 추가 후 `known-issues.ts`에서 제거 |

## 갱신 규칙

- 새 실패는 첫 확인일, 분류, 담당자, 관련 이슈 링크를 추가합니다.
- `quarantine`은 30일 안에 재검토합니다.
- 서비스 결함이 해결되거나 셀렉터가 수정되면 테스트를 `active`로 되돌리고 검증 날짜를 갱신합니다.
