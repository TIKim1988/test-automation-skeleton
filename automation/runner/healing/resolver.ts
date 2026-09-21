import type { Page, Locator } from '@playwright/test';
import type { ElementDef } from '../types';
import type { HealContext, HealResult, HealMode, HealEvent, Fingerprint } from './types';
import type { BaselineStore } from './baseline';
import { isResolvable, captureFingerprint, expectsPresence } from './capture';

/**
 * selectors/ 의 ElementDef 를 실제 Playwright Locator 로 만든다.
 * 원래 interpreter.ts 안에 있던 로직을 그대로 옮겨온 것으로,
 * primary(정상 경로) 로케이터의 "유일한" 생성 지점이다.
 *
 * 주의: 이 프로젝트의 셀렉터는 CSS 문자열이 아니라 role/testId/text/css/index 를 담은
 * ElementDef 다. (걔가 준 STEP 1 초안은 primaryCss:string 을 가정했지만, WIRING.md 의
 * 지시대로 실제 코드 스키마에 맞춰 def:ElementDef 로 적응했다.)
 */
export function buildPrimaryLocator(page: Page | Locator, def: ElementDef): Locator {
  let locator: Locator;
  if (def.testId) locator = page.getByTestId(def.testId);
  else if (def.role) locator = page.getByRole(def.role as Parameters<Page['getByRole']>[0], {
    name: def.nameRegex ? new RegExp(def.nameRegex) : def.name, exact: def.exact,
  });
  else if (def.text || def.textRegex) locator = page.getByText(def.textRegex ? new RegExp(def.textRegex) : def.text!, {exact:def.exact});
  else if (def.css) locator = page.locator(def.css);
  else throw new Error('빈 셀렉터 정의');
  return typeof def.index === 'number' ? locator.nth(def.index) : locator;
}

/**
 * 모든 로케이터 접근이 통과하는 단일 진입점.
 *
 * === STEP 1 (지금 이 파일) ===
 * primary 만 반환한다. 동작은 기존 interpreter 의 resolveLocator 와 100% 동일하다.
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
  primary?: Locator,
): Promise<HealResult> {
  const locator = primary ?? buildPrimaryLocator(page, def);

  // --- STEP 3: 감지 + 지문 캡처 (부수효과) ---
  // 캡처 모드(HEAL_CAPTURE=1)이고 "요소가 있어야 정상"인 액션일 때만, primary 를
  // 짧게 감지해서 잡히면 지문을 떠 baseline 에 적립한다. 액션에 실제로 쓰이는 로케이터는
  // 여전히 primary 이므로 통과/실패 결과는 바뀌지 않는다. (assert_hidden 등 부재가
  // 정상인 액션은 expectsPresence 로 애초에 제외 → 불필요한 프로브 타임아웃도 없음.)
  if (ctx.captureEnabled && expectsPresence(ctx.action)) {
    if (await isResolvable(locator)) {
      const fp: Fingerprint | undefined = await captureFingerprint(locator);
      if (fp) ctx.onCapture?.(logicalName, fp);
    }
  }

  return {
    locator,
    used: 'primary',
    healed: false,
    confidence: 1,
  };

  // --- STEP 4~5 에서 이 아래로 확장된다 (지금은 실행되지 않음) ---
  //
  // if (await isResolvable(locator)) {
  //   return { locator, used: 'primary', healed: false, confidence: 1 };
  // }
  // const fp = ctx.baseline?.[logicalName];                    // STEP 3 가 적립한 지문
  // for (const cand of buildCandidates(page, fp)) {            // testid -> role -> label -> text
  //   const loc = cand.build();
  //   if (!(await isUniqueMatch(loc))) continue;
  //   const score = scoreCandidate(cand, fp);
  //   if (score < THRESHOLD) continue;
  //   if (ctx.mode === 'strict') { recordAndThrow(...); }      // 배포 게이트: 힐링=실패
  //   ctx.healCount++;
  //   if (ctx.healCount > MAX_HEALS_PER_TEST) throwTooManyHeals(ctx);
  //   ctx.onHeal?.({ ...healEvent });
  //   return { locator: loc.first(), used: cand.strategy, healed: true, confidence: score };
  // }
  // throw new ElementNotResolvable(logicalName);
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
