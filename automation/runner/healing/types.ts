import type { Locator } from '@playwright/test';

/**
 * 힐링 전략. primary 만 selectors/(CSS) 소유이고,
 * 나머지는 전부 베이스라인(초록 실행에서 캡처한 지문)에서 파생된다.
 * (STEP 1 에서는 'primary' 만 실제로 쓰인다. 나머지는 STEP 3~4 에서 활성화)
 */
export type HealStrategy =
  | 'primary'
  | 'testid'
  | 'role'
  | 'label'
  | 'text'
  | 'structural';

/** 실행 강도. 스케줄=lenient(힐링 허용), 배포게이트=strict(힐링 발동=실패) */
export type HealMode = 'lenient' | 'strict';

/**
 * 초록 실행에서 실제 element 를 조회해 캡처하는 지문.
 * selectors/ 가 CSS 만 저장하므로 role/testid/label 폴백의 유일한 공급원.
 * (캡처 로직은 STEP 3 에서 구현. 여기선 타입만 미리 둔다.)
 */
export interface Fingerprint {
  tag: string;
  testid?: string;
  role?: string;
  name?: string;
  placeholder?: string;
  text?: string;
}

/** resolveLocator 의 반환. 어떤 전략으로 잡았는지와 힐링 여부를 담는다. */
export interface HealResult {
  locator: Locator;
  used: HealStrategy;
  healed: boolean;      // primary 가 아니면 true
  confidence: number;   // 0~1
}

/** 힐링이 실제로 발동했을 때 recorder 가 기록하는 이벤트 (STEP 2 에서 사용) */
export interface HealEvent {
  testId: string;
  stepIndex: number;
  action: string;
  logicalName: string;    // selectors/ 의 논리 키
  primarySelector: string;
  healedBy: HealStrategy;
  healedSelector: string; // 실제로 성공한 로케이터 표현
  confidence: number;
  timestamp: string;
}

/**
 * 한 테스트 실행 동안 넘겨다니는 힐링 컨텍스트.
 * STEP 1 에서는 mode 만 있으면 충분하고, 나머지 필드는 후속 단계가 채운다.
 */
export interface HealContext {
  testId: string;
  action: string;
  stepIndex: number;
  mode: HealMode;

  /** 이 테스트에서 지금까지 힐링된 횟수. MAX_HEALS_PER_TEST 가드레일용 (STEP 5) */
  healCount: number;

  /** 논리 이름 -> 지문. STEP 3 에서 주입 (이전 초록 실행에서 뜬 baseline) */
  baseline?: Record<string, Fingerprint>;

  /** 지문 캡처 모드 여부. 기본 off(=STEP 2 와 동작 동일). HEAL_CAPTURE=1 일 때만 on */
  captureEnabled?: boolean;

  /** 초록 실행에서 지문을 떴을 때의 적립 콜백 (STEP 3). spec 이 baseline 저장소에 연결 */
  onCapture?: (logicalName: string, fp: Fingerprint) => void;

  /** 힐링 발생 시 콜백. STEP 2 의 recorder 가 연결 */
  onHeal?: (event: HealEvent) => void;
}
