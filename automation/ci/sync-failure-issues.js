#!/usr/bin/env node
// Playwright JSON 리포트(test-results/results.json)를 읽어서 실패한 테스트케이스마다
// GitHub Issue를 관리합니다.
//
//   - 처음 실패: 새 이슈 생성 (라벨: test-failure, 제목: "[Test Failure] <ID> - <title>")
//   - 계속 실패(이미 열린 이슈 있음): 새 이슈를 또 만들지 않고 코멘트만 추가
//   - 더 이상 실패하지 않음(통과로 전환): 열려 있던 이슈를 코멘트와 함께 자동으로 닫음
//
// 테스트 ID(HOME-001, PRODUCT-004 등)를 키로 삼아 테스트당 이슈 1개만 유지합니다.
// flaky(재시도 후 통과)와 skipped(known-issues.ts 등)는 "실패"로 취급하지 않습니다.
//
// 전제: gh CLI가 GH_TOKEN으로 인증되어 있고, 워크플로 permissions에 issues: write가 있어야 합니다.
// (.github/workflows/scheduled-tests.yml 참고)

const fs = require('fs');
const { execFileSync } = require('child_process');

const RESULTS_PATH = 'test-results/results.json';
const LABEL = 'test-failure';
const RUN_URL = process.env.GITHUB_RUN_URL ?? '';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

function collectSpecs(suite, acc) {
  for (const spec of suite.specs ?? []) acc.push(spec);
  for (const child of suite.suites ?? []) collectSpecs(child, acc);
}

function extractTestId(title) {
  const m = title.match(/^([A-Z]+-\d+)/);
  return m ? m[1] : null;
}

function main() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.log(`${RESULTS_PATH} 없음, 이슈 동기화 스킵`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  const specs = [];
  for (const suite of report.suites ?? []) collectSpecs(suite, specs);

  // id -> { title, error }
  const failing = new Map();
  for (const spec of specs) {
    const id = extractTestId(spec.title);
    if (!id) continue;
    for (const test of spec.tests ?? []) {
      if (test.status !== 'unexpected') continue; // flaky/skipped/expected 제외
      const lastResult = test.results?.[test.results.length - 1];
      const errorMessage = (lastResult?.error?.message ?? '(에러 메시지 없음)').slice(0, 1500);
      failing.set(id, { title: spec.title, error: errorMessage });
    }
  }

  console.log(`실패 감지: ${failing.size}건`);

  const existingRaw = gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number,title', '--limit', '200']);
  const existing = JSON.parse(existingRaw);
  const existingById = new Map();
  for (const issue of existing) {
    const id = extractTestId(issue.title.replace('[Test Failure] ', ''));
    if (id) existingById.set(id, issue);
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const [id, info] of failing) {
    const body =
      `**${today} 실행에서 실패**\n\n` +
      `- 테스트: \`${info.title}\`\n` +
      `- 에러:\n\`\`\`\n${info.error}\n\`\`\`\n` +
      (RUN_URL ? `- 실행 로그: ${RUN_URL}\n` : '');

    const existingIssue = existingById.get(id);
    if (existingIssue) {
      gh(['issue', 'comment', String(existingIssue.number), '--body', body]);
      console.log(`코멘트 추가: #${existingIssue.number} (${id})`);
    } else {
      const title = `[Test Failure] ${info.title}`;
      gh(['issue', 'create', '--title', title, '--label', LABEL, '--body', body]);
      console.log(`새 이슈 생성: ${id}`);
    }
  }

  for (const [id, issue] of existingById) {
    if (failing.has(id)) continue;
    gh(['issue', 'close', String(issue.number), '--comment', `${today} 실행에서 통과 확인, 자동으로 닫습니다.`]);
    console.log(`이슈 닫음: #${issue.number} (${id})`);
  }
}

main();
