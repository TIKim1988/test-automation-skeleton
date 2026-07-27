import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { customSteps } from '../steps/custom';
import { buildHealContext } from '../runner/healing/resolver';
import { createHealRecorder } from '../runner/healing/recorder';
import { pendingTestIds } from '../runner/known-issues';
import type { TestCase } from '../runner/types';

// 이 파일은 "자동화 프로젝트"가 소유합니다.
// testcases/, selectors/, fixtures/ 는 다른 프로젝트(테스트케이스 관리)가 수정하지만,
// 같은 저장소를 공유하므로 여기서는 경로만 알면 됩니다. (내용은 절대 직접 고치지 않음)
const ROOT = path.resolve(__dirname, '../..');

const testCases: TestCase[] = loadTestCases(path.join(ROOT, 'testcases'));
const selectors = loadSelectors(path.join(ROOT, 'selectors'));
const fixtures = loadFixtures(path.join(ROOT, 'fixtures'));

// STEP 2: 힐링 발동을 heal-report.json 으로 남기는 recorder.
// (fullyParallel:false 라 단일 워커에서 모든 테스트 이벤트가 여기 모인다.)
const healRecorder = createHealRecorder();
const HEAL_REPORT_PATH = path.join(ROOT, 'test-results', 'heal-report.json');

test.afterAll(async () => {
  const report = healRecorder.flush(HEAL_REPORT_PATH);
  console.log(`[heal] total heals: ${report.totalHeals} -> ${HEAL_REPORT_PATH}`);
});

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
    const ctx = buildHealContext({ testId: testCase.id, onHeal: healRecorder.onHeal });
    await runTestCase(page, testCase, selectors, fixtures, customSteps, ctx);
  });
}
