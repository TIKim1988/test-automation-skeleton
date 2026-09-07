import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function summarize(results) {
  const stats = results.stats ?? {};
  const entries = [];
  const errors = (results.errors ?? []).map((error) => error.message ?? String(error));
  function visit(suites) {
    for (const suite of suites ?? []) {
      visit(suite.suites);
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          if (test.status === 'expected') continue;
          entries.push({
            title: spec.title, project: test.projectName ?? '', status: test.status,
            attempts: (test.results ?? []).map((result) => ({
              status: result.status, retry: result.retry ?? 0,
              message: result.error?.message ?? result.errors?.[0]?.message ?? '',
            })),
            annotations: test.annotations ?? [],
          });
        }
      }
    }
  }
  visit(results.suites);
  const counts = { passed: stats.expected ?? 0, failed: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0, skipped: stats.skipped ?? 0 };
  if (!results.stats) errors.push('실행 통계가 없어 결과를 판정할 수 없어.');
  if (Object.values(counts).some((n) => !Number.isInteger(n) || n < 0)) errors.push('실행 통계 형식이 잘못됐어.');
  if (counts.passed + counts.failed + counts.flaky === 0) errors.push('실제로 실행한 테스트가 없어.');
  const skippedCritical = entries.some((e) => e.status === 'skipped' &&
    e.annotations.some((a) => a.type === 'priority' && a.description === 'P1'));
  if (skippedCritical) errors.push('핵심 P1 테스트가 실행되지 않았어.');
  return { ...counts, errors, entries, ok: counts.failed === 0 && counts.flaky === 0 && errors.length === 0 };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
}

export function renderSummary(summary, runUrl) {
  const rows = summary.entries.map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong> ${escapeHtml(entry.project)} [${escapeHtml(entry.status)}]<ul>${entry.attempts.map((attempt) => `<li>시도 ${attempt.retry + 1}: ${escapeHtml(attempt.status)}<pre>${escapeHtml(attempt.message)}</pre></li>`).join('')}</ul></li>`).join('');
  return `<!doctype html><html lang="ko"><meta charset="UTF-8"><title>로마스토어 자동화 결과</title><body style="font-family:sans-serif;line-height:1.6">
<h1>${summary.ok ? '✅' : '❌'} 로마스토어 자동화 결과</h1>
<table border="1" cellpadding="8"><tr><th>통과</th><th>실패</th><th>재시도 통과</th><th>스킵</th><th>실행 오류</th></tr>
<tr><td>${summary.passed}</td><td>${summary.failed}</td><td>${summary.flaky}</td><td>${summary.skipped}</td><td>${summary.errors.length}</td></tr></table>
<h2>확인 대상</h2>${rows ? `<ol>${rows}</ol>` : '<p>개별 테스트 확인 대상 없음</p>'}
${summary.errors.length ? `<h2>실행 오류</h2><ul>${summary.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}
<p>실패는 자동화, 셀렉터, 데이터, 서비스 문제로 분류해서 <code>test-health.md</code>에 기록해.</p>
${runUrl ? `<p><a href="${escapeHtml(runUrl)}">실행 로그</a></p>` : ''}</body></html>`;
}

export function main() {
  const resultPath = path.resolve(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ?? 'test-results/results.json');
  const outputDir = path.dirname(resultPath);
  let results;
  try { results = JSON.parse(fs.readFileSync(resultPath, 'utf8')); }
  catch (error) { results = { errors: [{ message: `결과 파일 읽기 실패: ${error.message}` }] }; }
  const summary = summarize(results ?? {});
  const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'email-summary.html'), renderSummary(summary, runUrl));
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries({passed:summary.passed,failed:summary.failed,flaky:summary.flaky,skipped:summary.skipped,errors:summary.errors.length,ok:summary.ok,icon:summary.ok?'✅':'❌'}).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
  console.log(JSON.stringify({passed:summary.passed,failed:summary.failed,flaky:summary.flaky,skipped:summary.skipped,errors:summary.errors.length,ok:summary.ok}));
  if (!summary.ok) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
