import type { Page, Locator } from '@playwright/test';
import type { ElementDef } from '../types';
import type { Fingerprint, HealStrategy } from './types';

/**
 * STEP 4: primary 가 요소를 못 잡았을 때, baseline 지문(Fingerprint)으로부터
 * 폴백 후보를 "testid -> role -> label -> text" 순으로 만든다.
 *
 * 순서에는 이유가 있다. testid 는 개발자가 명시적으로 박은 안정적 앵커라 1순위.
 * role(+접근성 이름)은 의미 기반이라 그 다음. label/placeholder 는 폼 요소 특화.
 * text 는 문구가 자주 바뀌어 신뢰도가 낮아 최후순위.
 *
 * planCandidates / scoreCandidate / describeDef 는 page 없이 동작하는 순수 함수라
 * 유닛 테스트로 검증한다. buildCandidates 만 실제 Locator 를 만든다.
 */

export interface CandidatePlan {
  strategy: HealStrategy;
  desc: string;      // heal-report 에 남길 사람이 읽는 표현
}

export interface Candidate extends CandidatePlan {
  locator: Locator;
  confidence: number;
}

/** 지문에서 만들 수 있는 후보를 우선순위 순으로 나열(page 불필요, 순수). */
export function planCandidates(fp: Fingerprint): CandidatePlan[] {
  const plans: CandidatePlan[] = [];
  if (fp.testid) plans.push({ strategy: 'testid', desc: `getByTestId(${fp.testid})` });
  if (fp.role) {
    plans.push({
      strategy: 'role',
      desc: fp.name ? `getByRole(${fp.role}, name=${JSON.stringify(fp.name)})` : `getByRole(${fp.role})`,
    });
  }
  if (fp.placeholder) plans.push({ strategy: 'label', desc: `getByPlaceholder(${JSON.stringify(fp.placeholder)})` });
  else if (fp.name) plans.push({ strategy: 'label', desc: `getByLabel(${JSON.stringify(fp.name)})` });
  if (fp.text) plans.push({ strategy: 'text', desc: `getByText(${JSON.stringify(fp.text)})` });
  return plans;
}

/**
 * 후보 신뢰도(0~1). 전략의 안정성 + 지문의 구체성으로 가른다.
 * STEP 5 에서 이 값에 임계값을 걸어 "애매한 힐링"을 막는다.
 */
export function scoreCandidate(strategy: HealStrategy, fp: Fingerprint): number {
  switch (strategy) {
    case 'testid': return 0.95;
    case 'role':   return fp.name ? 0.85 : 0.6;
    case 'label':  return 0.8;
    case 'text':   return 0.7;
    default:       return 0.5;
  }
}

/** primary(ElementDef)를 heal-report 용 문자열로 요약. */
export function describeDef(def: ElementDef): string {
  const parts: string[] = [];
  if (def.testId) parts.push(`testId=${def.testId}`);
  if (def.role) parts.push(`role=${def.role}`);
  if (def.name) parts.push(`name=${def.name}`);
  if (def.text) parts.push(`text=${def.text}`);
  if (def.css) parts.push(`css=${def.css}`);
  if (typeof def.index === 'number') parts.push(`index=${def.index}`);
  return parts.length ? parts.join(' ') : JSON.stringify(def);
}

/** 계획을 실제 Locator 로 바인딩한다(우선순위 순). */
export function buildCandidates(page: Page, fp: Fingerprint): Candidate[] {
  return planCandidates(fp).map((plan) => ({
    ...plan,
    confidence: scoreCandidate(plan.strategy, fp),
    locator: toLocator(page, plan.strategy, fp),
  }));
}

function toLocator(page: Page, strategy: HealStrategy, fp: Fingerprint): Locator {
  switch (strategy) {
    case 'testid':
      return page.getByTestId(fp.testid as string);
    case 'role':
      return page.getByRole(
        fp.role as Parameters<Page['getByRole']>[0],
        fp.name ? { name: fp.name } : undefined,
      );
    case 'label':
      return fp.placeholder
        ? page.getByPlaceholder(fp.placeholder)
        : page.getByLabel(fp.name as string);
    case 'text':
      return page.getByText(fp.text as string);
    default:
      // 도달하지 않음(계획 단계에서 위 4종만 생성)
      return page.locator(':root');
  }
}
