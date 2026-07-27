import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { customSteps } from '../steps/custom';
import { buildHealContext } from '../runner/healing/resolver';
import { createHealRecorder } from '../runner/healing/recorder';
import { loadBaseline, saveBaseline, mergeFingerprint, type BaselineStore } from '../runner/healing/baseline';
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

// STEP 3: 이전 초록 실행에서 뜬 지문 baseline 을 읽어 각 테스트 ctx 에 주입(STEP 4 폴백 재료).
// HEAL_CAPTURE=1 로 돌리면 이번 실행에서 지문을 다시 떠 baseline.json 을 갱신한다.
const BASELINE_PATH = path.join(ROOT, 'automation', 'runner', 'healing', 'baseline.json');
const HEAL_CAPTURE = process.env.HEAL_CAPTURE === '1';
const baseline: BaselineStore = loadBaseline(BASELINE_PATH);
let captured: BaselineStore = { ...baseline };

test.afterAll(async () => {
  const report = healRecorder.flush(HEAL_REPORT_PATH);
  console.log(`[heal] total heals: ${report.totalHeals} -> ${HEAL_REPORT_PATH}`);
  if (HEAL_CAPTURE) {
    saveBaseline(BASELINE_PATH, captured);
    console.log(`[heal] baseline captured: ${Object.keys(captured).length} elements -> ${BASELINE_PATH}`);
  }
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
    const ctx = buildHealContext({
      testId: testCase.id,
      baseline,
      onHeal: healRecorder.onHeal,
      onCapture: (name, fp) => { captured = mergeFingerprint(captured, name, fp); },
    });
    await runTestCase(page, testCase, selectors, fixtures, customSteps, ctx);
  });
}
