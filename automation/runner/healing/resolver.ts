import type { Page, Locator } from '@playwright/test';
import type { ElementDef } from '../types';
import type { HealContext, HealResult, HealMode, HealEvent, Fingerprint } from './types';
import type { BaselineStore } from './baseline';
import { isResolvable, isUniqueMatch, captureFingerprint, expectsPresence } from './capture';
import { buildCandidates, describeDef } from './candidates';

/**
 * selectors/ 의 ElementDef 를 실제 Playwright Locator 로 만든다.
 * 원래 interpreter.ts 안에 있던 로직을 그대로 옮겨온 것으로,
 * primary(정상 경로) 로케이터의 "유일한" 생성 지점이다.
 *
 * 주의: 이 프로젝트의 셀렉터는 CSS 문자열이 아니라 role/testId/text/css/index 를 담은
 * ElementDef 다. (걔가 준 STEP 1 초안은 primaryCss:string 을 가정했지만, WIRING.md 의
 * 지시대로 실제 코드 스키마에 맞춰 def:ElementDef 로 적응했다.)
 */
export function buildPrimaryLocator(page: Page, def: ElementDef): Locator {
  let locator: Locator;
  if (def.testId) locator = page.getByTestId(def.testId);
  else if (def.role) locator = page.getByRole(def.role as Parameters<Page['getByRole']>[0], def.name ? { name: def.name } : undefined);
  else if (def.text) locator = page.getByText(def.text);
  else if (def.css) locator = page.locator(def.css);
  else throw new Error(`셀렉터 정의에 role/testId/text/css 중 하나가 필요합니다: ${JSON.stringify(def)}`);
  // index 필드가 있으면 nth()로 특정 인덱스 요소만 선택 (strict mode 위반 방지)
  return typeof def.index === 'number' ? locator.nth(def.index) : locator;
}

/**
 * 모든 로케이터 접근이 통과하는 단일 진입점.
 *
 * === 현재: STEP 4 까지 반영 ===
 * primary 로 잡히면 primary 를 쓰고, 못 잡히면 baseline 지문으로 폴백(힐링)한다.
 * baseline 이 비어 있으면 힐링 분기가 돌지 않아 STEP 3 와 동작이 같다.
 * Playwright locator 는 지연 평가(lazy)라서, 여기서 만든 locator 를 그대로 돌려주면
 * 실제 탐색은 뒤의 .click()/.fill() 시점에 일어난다. 즉 힐링을 아직 안 붙였어도
 * 기존과 완전히 같은 타이밍/동작이 보장된다. (무해한 리팩터링)
 *
 * 목적은 "모든 호출부를 이 함수로 모으는 것" 하나뿐이다. 호출부를 여기로 모아두면
 * STEP 3~5 에서 이 함수 내부만 바꿔도 인터프리터 전체에 힐링이 적용된다.
 *
 * === 이후 단계에서 이 함수 안에 붙는 것 ===
 * STEP 3: primary 가 요소를 못 잡는지 짧은 타임아웃으로 감지
 * STEP 4: 못 잡으면 baseline 지문으로 testid/role/label/text 후보 캐스케이드
 * STEP 5: 신뢰도 임계값 / MAX_HEALS_PER_TEST / strict 모드 처리
 */
export async function resolveLocator(
  page: Page,
  logicalName: string,
  def: ElementDef,
  ctx: HealContext,
): Promise<HealResult> {
  const locator = buildPrimaryLocator(page, def);

  // 요소가 있어야 정상인 액션에서만 감지/캡처/힐링이 의미가 있다.
  // (assert_hidden 등 부재가 정상인 액션은 여기서 제외 → primary 그대로 반환)
  if (expectsPresence(ctx.action)) {
    if (ctx.captureEnabled) {
      // --- STEP 3: 지문 캡처 (초록 실행에서 baseline 적립) ---
      // 캡처 실행에서는 힐링을 하지 않는다. baseline 을 "정상 상태"로만 채우기 위함.
      if (await isResolvable(locator)) {
        const fp: Fingerprint | undefined = await captureFingerprint(locator);
        if (fp) ctx.onCapture?.(logicalName, fp);
      }
    } else if (ctx.baseline) {
      // --- STEP 4: 힐링 캐스케이드 ---
      // baseline 에 이 논리이름의 지문이 있고 primary 가 짧은 타임아웃 안에 요소를
      // 못 잡으면, 지문으로 testid -> role -> label -> text 후보를 훑어 "딱 하나"를
      // 가리키는 첫 후보로 힐링한다. 힐링 사실은 onHeal 로 기록한다(heal-report.json).
      //
      // 안전 성질: baseline 이 비어 있으면(아직 캡처 안 함) 이 분기 자체가 안 돌아
      // 동작이 STEP 3 와 동일하다. primary 가 정상일 때도 곧바로 primary 를 쓴다.
      const fp = ctx.baseline[logicalName];
      if (fp && !(await isResolvable(locator))) {
        for (const cand of buildCandidates(page, fp)) {   // testid -> role -> label -> text
          if (!(await isUniqueMatch(cand.locator))) continue;
          // STEP 5 에서 이 지점에 신뢰도 임계값 / MAX_HEALS_PER_TEST / strict(힐링=실패)가 붙는다.
          ctx.healCount++;
          ctx.onHeal?.({
            testId: ctx.testId,
            stepIndex: ctx.stepIndex,
            action: ctx.action,
            logicalName,
            primarySelector: describeDef(def),
            healedBy: cand.strategy,
            healedSelector: cand.desc,
            confidence: cand.confidence,
            timestamp: new Date().toISOString(),
          });
          return { locator: cand.locator.first(), used: cand.strategy, healed: true, confidence: cand.confidence };
        }
        // 어떤 후보도 유일 매칭이 아니면 힐링 실패 → primary 를 그대로 돌려준다.
        // (액션은 기존처럼 primary 로 시도하고 실패한다 = 힐링 전과 동일한 빨강)
      }
    }
  }

  return {
    locator,
    used: 'primary',
    healed: false,
    confidence: 1,
  };
}

/**
 * 테스트 시작 시 컨텍스트를 하나 만들어 스텝들에 넘긴다.
 * STEP 1 에서는 mode 와 식별자만 채우면 된다.
 */
export function buildHealContext(args: {
  testId: string;
  mode?: HealMode;
  baseline?: BaselineStore;
  onHeal?: (event: HealEvent) => void;
  onCapture?: (logicalName: string, fp: Fingerprint) => void;
}): HealContext {
  return {
    testId: args.testId,
    action: '',
    stepIndex: 0,
    mode: args.mode ?? (process.env.HEAL_MODE === 'strict' ? 'strict' : 'lenient'),
    healCount: 0,
    baseline: args.baseline,
    captureEnabled: process.env.HEAL_CAPTURE === '1',
    onHeal: args.onHeal,
    onCapture: args.onCapture,
  };
}
