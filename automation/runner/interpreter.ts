import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ElementDef, SelectorMap, Step, TestCase } from './types';
import { resolveTemplate } from './loader';
import { resolveLocator } from './healing/resolver';
import type { HealContext } from './healing/types';

export type CustomStepFn = (page: Page, step: Step, ctx: Record<string, unknown>) => Promise<void>;

function requireElement(selectors: SelectorMap, target?: string): ElementDef {
  if (!target || !selectors.elements[target]) {
    throw new Error(`selectors 파일에 정의되지 않은 element target 입니다: ${target}`);
  }
  return selectors.elements[target];
}

// 요소를 잡는 모든 지점이 통과하는 단일 경로.
// STEP 1: 힐링 모듈의 resolveLocator 로 primary 로케이터만 받아온다 (동작 동일).
// STEP 3~5 에서 resolver.ts 내부만 바꾸면 여기 전체에 힐링이 적용된다.
async function loc(
  page: Page,
  selectors: SelectorMap,
  target: string | undefined,
  ctx: HealContext,
): Promise<Locator> {
  const def = requireElement(selectors, target);
  const { locator } = await resolveLocator(page, target as string, def, ctx);
  return locator;
}

// 테스트케이스 yaml의 steps를 한 줄씩 실제 Playwright 동작으로 변환/실행합니다.
// 이 함수 자체는 "무엇을 하는지"만 알고, 화면이 어떻게 바뀌었는지는 selectors.yaml에 위임합니다.
export async function runTestCase(
  page: Page,
  testCase: TestCase,
  selectors: SelectorMap,
  data: Record<string, unknown>,
  customSteps: Record<string, CustomStepFn> = {},
  ctx: HealContext
): Promise<void> {
  for (const step of testCase.steps) {
    const value = step.value !== undefined ? resolveTemplate(step.value, data) : undefined;

    switch (step.action) {
      case 'navigate': {
        const url = step.target ? selectors.pages[step.target] : '/';
        if (!url) throw new Error(`selectors 파일에 정의되지 않은 page target 입니다: ${step.target}`);
        await page.goto(url);
        break;
      }
      case 'click':
        await (await loc(page, selectors, step.target, ctx)).click();
        break;
      case 'fill':
        await (await loc(page, selectors, step.target, ctx)).fill(value ?? '');
        break;
      case 'select':
        await (await loc(page, selectors, step.target, ctx)).selectOption(value ?? '');
        break;
      case 'check':
        await (await loc(page, selectors, step.target, ctx)).check();
        break;
      case 'uncheck':
        await (await loc(page, selectors, step.target, ctx)).uncheck();
        break;
      case 'assert_visible':
        await expect(await loc(page, selectors, step.target, ctx)).toBeVisible();
        break;
      case 'assert_hidden':
        await expect(await loc(page, selectors, step.target, ctx)).toBeHidden();
        break;
      case 'assert_text':
        await expect(await loc(page, selectors, step.target, ctx)).toHaveText(value ?? '');
        break;
      case 'wait':
        await page.waitForTimeout(step.timeoutMs ?? 1000);
        break;
      case 'custom': {
        const fn = step.name ? customSteps[step.name] : undefined;
        if (!fn) throw new Error(`steps/custom.ts 에 등록되지 않은 custom step 입니다: ${step.name}`);
        await fn(page, step, data);
        break;
      }
      default:
        throw new Error(`알 수 없는 step action: ${step.action}`);
    }
  }
}
