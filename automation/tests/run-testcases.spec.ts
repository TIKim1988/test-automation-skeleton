import { test } from '@playwright/test';
import path from 'path';
import { loadTestCases, loadFixtures } from '../runner/loader';
import { loadSelectors } from '../runner/selectors';
import { runTestCase } from '../runner/interpreter';
import { customSteps } from '../steps/custom';

// 이 파일은 "자동화 프로젝트"가 소유합니다.
// testcases/, selectors/ 는 다른 프로젝트(테스트케이스 관리)가 수정하지만,
// 같은 저장소를 공유하므로 여기서는 경로만 알면 됩니다.
const ROOT = path.resolve(__dirname, '../..');
const testCases = loadTestCases(path.join(ROOT, 'testcases'));
const selectors = loadSelectors(path.join(ROOT, 'selectors'));
const fixtures = loadFixtures(path.join(ROOT, 'fixtures/users.yaml'));

for (const testCase of testCases) {
  test(`${testCase.id} - ${testCase.title}`, async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await runTestCase(page, testCase, selectors, fixtures, customSteps);
  });
}
