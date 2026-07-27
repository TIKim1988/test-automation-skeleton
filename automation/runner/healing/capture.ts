import type { Locator } from '@playwright/test';
import type { Fingerprint } from './types';

/**
 * STEP 3: primary 로케이터가 "지금 이 화면에서" 요소를 실제로 잡는지 감지 + 지문 캡처.
 *
 * 두 가지를 제공한다.
 *  1) isResolvable  — primary 가 요소를 못 잡는지 짧은 타임아웃으로 감지 (힐링 발동 조건의 씨앗)
 *  2) captureFingerprint — 초록 실행에서 실제 element 를 조회해 지문을 뜬다.
 *     selectors/ 는 primary(CSS/role/testId 등)만 저장하므로, role/testid/label/text
 *     폴백(STEP 4)의 유일한 공급원이 이 지문이다.
 *
 * 이 단계에서는 "동작"을 바꾸지 않는다. 액션에는 여전히 primary 로케이터가 쓰이고,
 * 여기 함수들은 부수효과(감지 결과 관찰 / baseline 적립)로만 동작한다.
 */

/** primary 감지에 쓰는 짧은 타임아웃(ms). 기본 1000, HEAL_PROBE_TIMEOUT_MS 로 조정 */
export const PROBE_TIMEOUT_MS = Number(process.env.HEAL_PROBE_TIMEOUT_MS ?? 1000);

/**
 * 짧은 타임아웃 안에 요소가 DOM 에 attached 되는지로 primary 해결 가능 여부를 판단한다.
 * (visible 이 아니라 attached 기준: assert_hidden 같은 케이스는 호출부에서 애초에 제외한다.)
 */
export async function isResolvable(
  locator: Locator,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'attached', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * 요소의 지문을 캡처한다. 실패해도(요소 없음 등) 던지지 않고 undefined 를 돌려준다.
 * — 캡처는 어디까지나 부수효과이므로 테스트 흐름을 절대 깨면 안 된다.
 */
export async function captureFingerprint(locator: Locator): Promise<Fingerprint | undefined> {
  try {
    const el = locator.first();
    const fp = await el.evaluate((node: Element): Fingerprint => {
      const e = node as HTMLElement;
      const attr = (n: string): string | undefined => {
        const v = e.getAttribute(n);
        return v != null && v !== '' ? v : undefined;
      };
      const text = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        tag: e.tagName.toLowerCase(),
        testid: attr('data-testid'),
        role: attr('role'),
        name: attr('aria-label') ?? (e as HTMLInputElement).name ?? undefined,
        placeholder: attr('placeholder'),
        text: text ? text.slice(0, 120) : undefined,
      };
    });
    return fp;
  } catch {
    return undefined;
  }
}

/**
 * 이 action 이 "요소가 존재해야 정상"인 종류인지. assert_hidden 처럼 부재가 정상인
 * 액션은 primary 미해결을 힐링 대상으로 봐선 안 되므로 감지/캡처에서 제외한다.
 */
const PRESENCE_EXPECTING = new Set<string>([
  'click', 'fill', 'select', 'check', 'uncheck', 'assert_visible', 'assert_text',
]);

export function expectsPresence(action: string): boolean {
  return PRESENCE_EXPECTING.has(action);
}
