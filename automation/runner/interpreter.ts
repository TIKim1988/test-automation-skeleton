import { expect, test, type Page, type Locator } from '@playwright/test';
import type { ElementDef, SelectorMap, Step, TestCase } from './types';
import { resolveTemplate } from './loader';

export type CustomStepFn = (page: Page, step: Step, ctx: Record<string, unknown>) => Promise<void>;

export function resolveLocator(page: Page, selectors: SelectorMap, target: string, data: Record<string, unknown>, chain: string[] = []): Locator {
  const def: ElementDef = selectors.elements[target];
  if (!def) throw new Error(`정의되지 않은 element: ${target}`);
  if (chain.includes(target)) throw new Error(`selector scope 순환 참조: ${[...chain, target].join(' -> ')}`);
  const root: Page | Locator = def.scope ? resolveLocator(page, selectors, def.scope, data, [...chain, target]) : page;
  const render = (value: string) => resolveTemplate(value, data);
  if (def.testId) return root.getByTestId(render(def.testId));
  if (def.role) return root.getByRole(def.role as Parameters<Page['getByRole']>[0], {
    name: def.nameRegex ? new RegExp(render(def.nameRegex)) : def.name ? render(def.name) : undefined,
    exact: def.exact,
  });
  if (def.text || def.textRegex) return root.getByText(def.textRegex ? new RegExp(render(def.textRegex)) : render(def.text!), { exact: def.exact });
  if (def.css) return root.locator(render(def.css));
  throw new Error(`셀렉터 정의가 비어 있어: ${target}`);
}

export async function runTestCase(page: Page, testCase: TestCase, selectors: SelectorMap,
  data: Record<string, unknown>, customSteps: Record<string, CustomStepFn> = {}): Promise<void> {
  // fixture 원본은 읽기 전용, 계산한 기준 금액과 수량은 현재 테스트 안에서만 사용해.
  const context = structuredClone(data);
  for (const [index, step] of testCase.steps.entries()) {
    await test.step(`${testCase.id} ${index + 1}: ${step.action} ${step.target ?? step.name ?? ''}`, async () => {
      const value = step.value !== undefined ? resolveTemplate(step.value, context) : undefined;
      const locator = () => resolveLocator(page, selectors, step.target ?? '', context);
      switch (step.action) {
        case 'navigate': {
          const url = step.target ? selectors.pages[step.target] : undefined;
          if (!url) throw new Error(`정의되지 않은 page: ${step.target}`);
          await page.goto(resolveTemplate(url, context));
          break;
        }
        case 'click':
          if (/결제하기/.test(selectors.elements[step.target ?? '']?.name ?? '') || step.target === 'final_pay_button') throw new Error('최종 결제는 운영 테스트 범위 밖이야.');
          await locator().click(); break;
        case 'fill': await locator().fill(value ?? ''); break;
        case 'select': await locator().selectOption(value ?? ''); break;
        case 'check': await locator().check(); break;
        case 'uncheck': await locator().uncheck(); break;
        case 'assert_visible': await expect(locator()).toBeVisible(); break;
        case 'assert_hidden': await expect(locator()).toBeHidden(); break;
        case 'assert_text': await expect(locator()).toHaveText(value ?? ''); break;
        case 'assert_value': await expect(locator()).toHaveValue(value ?? ''); break;
        case 'assert_checked': await expect(locator()).toBeChecked(); break;
        case 'assert_unchecked': await expect(locator()).not.toBeChecked(); break;
        case 'assert_enabled': await expect(locator()).toBeEnabled(); break;
        case 'assert_disabled': await expect(locator()).toBeDisabled(); break;
        case 'assert_attribute':
          if (typeof step.params?.attribute !== 'string') throw new Error('assert_attribute에는 attribute가 필요해.');
          await expect(locator()).toHaveAttribute(step.params.attribute, value ?? ''); break;
        case 'assert_url':
          await expect(page).toHaveURL(new RegExp(value ?? '')); break;
        case 'wait': await page.waitForTimeout(step.timeoutMs ?? 1000); break;
        case 'custom': {
          const fn = step.name ? customSteps[step.name] : undefined;
          if (!fn) throw new Error(`등록되지 않은 custom step: ${step.name}`);
          await fn(page, { ...step, value }, context); break;
        }
        default: throw new Error(`알 수 없는 action: ${step.action}`);
      }
    });
  }
}
