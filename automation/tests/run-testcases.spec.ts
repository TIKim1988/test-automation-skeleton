import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { selectCases } from '../runner/selection';
import { customSteps } from '../steps/custom';
import { buildHealContext } from '../runner/healing/resolver';
import { createHealRecorder } from '../runner/healing/recorder';
import { loadBaseline, saveBaseline, mergeFingerprint } from '../runner/healing/baseline';

const ROOT = path.resolve(__dirname, '../..');
const requestedTags = (process.env.TEST_TAGS ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
const quarantineOnly = process.env.TEST_QUARANTINE === '1';
const testCases = selectCases(loadTestCases(path.join(ROOT, 'testcases')), requestedTags, quarantineOnly);
if (!testCases.length) throw new Error('선택된 테스트가 없어. TEST_TAGS와 TC 상태를 확인해.');
const selectors = loadSelectors(path.join(ROOT, 'selectors'));
const fixtures = loadFixtures(path.join(ROOT, 'fixtures'));

const recorder = createHealRecorder();
const baselinePath = path.join(ROOT, 'automation/runner/healing/baseline.json');
let baseline = loadBaseline(baselinePath);
test.afterAll(() => {
  recorder.flush(path.join(ROOT, 'test-results/heal-report.json'));
  if (process.env.HEAL_CAPTURE === '1') saveBaseline(baselinePath, baseline);
});
for (const testCase of testCases) {
  const register = testCase.status === 'quarantine' && !quarantineOnly ? test.skip : test;
  register(`${testCase.id} - ${testCase.title}`, {
    annotation: [{ type: 'case_id', description: testCase.id }, { type: 'priority', description: testCase.priority ?? 'P2' }],
  }, async ({ page }) => {
    let captured = {...baseline};
    const heal = buildHealContext({testId:testCase.id, baseline, onHeal:recorder.onHeal,
      onCapture:(name, fp) => { captured = mergeFingerprint(captured, name, fp); }});
    await runTestCase(page, testCase, selectors, fixtures, customSteps, heal);
    baseline = captured;
  });
}
