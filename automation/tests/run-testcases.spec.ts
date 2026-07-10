import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { customSteps } from '../steps/custom';
import { pendingTestIds } from '../runner/known-issues';
import type { TestCase } from '../runner/types';

// 이 파일은 "자동화 프로젝트"가 소유합니다.
// testcases/, selectors/, fixtures/ 는 다른 프로젝트(테스트케이스 관리)가 수정하지만,
// 같은 저장소를 공유하므로 여기서는 경로만 알면 됩니다. (내용은 절대 직접 고치지 않음)
const ROOT = path.resolve(__dirname, '../..');

const testCases: TestCase[] = loadTestCases(path.join(ROOT, 'testcases'));
const selectors = loadSelectors(path.join(ROOT, 'selectors'));
const fixtures = loadFixtures(path.join(ROOT, 'fixtures'));

// 테스트케이스가 참조하는 요소 중 하나라도 아직 실제 DOM에 없는 testId(known-issues.ts 참고)를
// 쓴다면, 실패 대신 사유를 남기고 skip 합니다.
function pendingReasonFor(testCase: TestCase): string | undefined {
  for (const step of testCase.steps) {
    const el = step.target ? selectors.elements[step.target] : undefined;
    if (el?.testId && pendingTestIds[el.testId]) {
      return pendingTestIds[el.testId];
    }
  }
  return undefined;
}

for (const testCase of testCases) {
  const pendingReason = pendingReasonFor(testCase);

  test(`${testCase.id} - ${testCase.title}`, async ({ page }) => {
    test.skip(Boolean(pendingReason), pendingReason);
    page.on('dialog', (dialog) => dialog.dismiss());
    await runTestCase(page, testCase, selectors, fixtures, customSteps);
  });
}
