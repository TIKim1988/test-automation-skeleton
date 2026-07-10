// 자동화 프로젝트가 파악한, 실제 프론트엔드 DOM에는 아직 반영되지 않은 testId 목록입니다.
//
// selectors/*.yaml 쪽에는 testId로 정의되어 있지만 (테스트케이스 관리 프로젝트가 실제 화면을
// 확인하며 "이 요소는 role/name만으로 특정할 수 없어 testId가 필요하다"고 표시해둔 자리),
// 실제 서비스 DOM에는 아직 data-testid 속성이 없어서 셀렉터가 아무것도 찾지 못하는 상태입니다.
//
// 이런 요소를 참조하는 테스트케이스를 그냥 실행하면 타임아웃으로 실패(빨간불)하는데, 이는
// "자동화가 잘못됐다"가 아니라 "프론트엔드에 아직 요청이 반영되지 않았다"는 신호입니다.
// 구분이 되도록 여기 등록된 testId를 참조하는 테스트는 사유와 함께 skip 처리합니다.
//
// 프론트엔드에 실제로 testId가 추가되면 이 목록에서 항목을 지우면 됩니다 (더 이상 skip되지 않고
// 정상적으로 실행/검증됩니다).
export const pendingTestIds: Record<string, string> = {
  'product-title':
    'lomastore.com 상품 상세 페이지의 상품명(h1)에 data-testid가 아직 없음 (selectors/product.yaml 주석 참고). 프론트엔드에 testId 부여 요청 필요.',
  'product-total-quantity':
    'lomastore.com 수량 표시 영역(총 N개)에 data-testid가 아직 없음 (selectors/product.yaml 주석 참고). 프론트엔드에 testId 부여 요청 필요.',
};
