import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { selectCases } from '../runner/selection';
import { customSteps } from '../steps/custom';

const ROOT = path.resolve(__dirname, '../..');
const requestedTags = (process.env.TEST_TAGS ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
const quarantineOnly = process.env.TEST_QUARANTINE === '1';
const testCases = selectCases(loadTestCases(path.join(ROOT, 'testcases')), requestedTags, quarantineOnly);
if (!testCases.length) throw new Error('선택된 테스트가 없어. TEST_TAGS와 TC 상태를 확인해.');
const selectors = loadSelectors(path.join(ROOT, 'selectors'));
const fixtures = loadFixtures(path.join(ROOT, 'fixtures'));

for (const testCase of testCases) {
  const register = testCase.status === 'quarantine' && !quarantineOnly ? test.skip : test;
  register(`${testCase.id} - ${testCase.title}`, {
    annotation: [{ type: 'case_id', description: testCase.id }, { type: 'priority', description: testCase.priority ?? 'P2' }],
  }, async ({ page }) => {
    await runTestCase(page, testCase, selectors, fixtures, customSteps);
  });
}
