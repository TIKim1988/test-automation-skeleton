import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ElementDef, SelectorMap, Step, TestCase } from './types';
import { resolveTemplate } from './loader';

export type CustomStepFn = (page: Page, step: Step, ctx: Record<string, unknown>) => Promise<void>;

function resolveLocator(page: Page, def: ElementDef): Locator {
  let locator: Locator;
  if (def.testId) locator = page.getByTestId(def.testId);
  else if (def.role) locator = page.getByRole(def.role as Parameters<Page['getByRole']>[0], def.name ? { name: def.name } : undefined);
  else if (def.text) locator = page.getByText(def.text);
  else if (def.css) locator = page.locator(def.css);
  else throw new Error(`셀렉터 정의에 role/testId/text/css 중 하나가 필요합니다: ${JSON.stringify(def)}`);
  // index 필드가 있으면 nth()로 특정 인덱스 요소만 선택 (strict mode 위반 방지)
  return typeof def.index === 'number' ? locator.nth(def.index) : locator;
}

function requireElement(selectors: SelectorMap, target?: string): ElementDef {
  if (!target || !selectors.elements[target]) {
    throw new Error(`selectors 파일에 정의되지 않은 element target 입니다: ${target}`);
  }
  return selectors.elements[target];
}

// 테스트케이스 yaml의 steps를 한 줄씩 실제 Playwright 동작으로 변환/실행합니다.
// 이 함수 자체는 "무엇을 하는지"만 알고, 화면이 어떻게 바뀌었는지는 selectors.yaml에 위임합니다.
export async function runTestCase(
  page: Page,
  testCase: TestCase,
  selectors: SelectorMap,
  data: Record<string, unknown>,
  customSteps: Record<string, CustomStepFn> = {}
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
        await resolveLocator(page, requireElement(selectors, step.target)).click();
        break;
      case 'fill':
        await resolveLocator(page, requireElement(selectors, step.target)).fill(value ?? '');
        break;
      case 'select':
        await resolveLocator(page, requireElement(selectors, step.target)).selectOption(value ?? '');
        break;
      case 'check':
        await resolveLocator(page, requireElement(selectors, step.target)).check();
        break;
      case 'uncheck':
        await resolveLocator(page, requireElement(selectors, step.target)).uncheck();
        break;
      case 'assert_visible':
        await expect(resolveLocator(page, requireElement(selectors, step.target))).toBeVisible();
        break;
      case 'assert_hidden':
        await expect(resolveLocator(page, requireElement(selectors, step.target))).toBeHidden();
        break;
      case 'assert_text':
        await expect(resolveLocator(page, requireElement(selectors, step.target))).toHaveText(value ?? '');
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
