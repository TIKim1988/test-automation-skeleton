import fs from 'node:fs';
import path from 'node:path';

const resultPath = path.resolve('test-results/results.json');
const outputPath = path.resolve('test-results/email-summary.html');
const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const stats = results.stats ?? {};
const failed = (stats.unexpected ?? 0) + (stats.flaky ?? 0);

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function collectFailures(suites, entries = []) {
  for (const suite of suites ?? []) {
    collectFailures(suite.suites, entries);
    for (const spec of suite.specs ?? []) {
      const lastResult = spec.tests?.at(-1)?.results?.at(-1);
      if (lastResult?.status === 'failed' || lastResult?.status === 'timedOut') {
        entries.push({ title: spec.title, message: lastResult.error?.message ?? '상세 오류는 HTML 리포트를 확인하세요.' });
      }
    }
  }
  return entries;
}

const failures = collectFailures(results.suites);
const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const failureRows = failures.length
  ? `<ol>${failures.map((failure) => `<li><strong>${escapeHtml(failure.title)}</strong><br><code>${escapeHtml(failure.message.split('\n')[0])}</code></li>`).join('')}</ol>`
  : '<p>실패한 테스트가 없습니다.</p>';

const html = `<!doctype html><html lang="ko"><body style="font-family:Arial,sans-serif;line-height:1.5">
<h2>${failed > 0 ? '❌' : '✅'} lomastore 자동화 결과</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
  <tr><th>통과</th><th>실패</th><th>스킵</th></tr>
  <tr><td>${stats.expected ?? 0}</td><td>${failed}</td><td>${stats.skipped ?? 0}</td></tr>
</table>
<p><strong>실패 분류 원칙:</strong> 아래 실패는 우선 확인 대상으로 표시합니다. 셀렉터 노후화·테스트 데이터·서비스 결함으로 분류한 뒤 `test-health.md`에 기록하세요.</p>
<h3>실패 항목</h3>${failureRows}
<p><a href="${runUrl}">GitHub Actions 실행 로그 열기</a></p>
<p>상세 스크린샷·trace는 첨부된 HTML 리포트 또는 GitHub artifact에서 확인할 수 있습니다.</p>
</body></html>`;

fs.writeFileSync(outputPath, html);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, [
    `passed=${stats.expected ?? 0}`,
    `failed=${failed}`,
    `skipped=${stats.skipped ?? 0}`,
    `icon=${failed > 0 ? '❌' : '✅'}`,
  ].join('\n') + '\n');
}
console.log(`Summarized ${stats.expected ?? 0} passed, ${failed} failed, ${stats.skipped ?? 0} skipped.`);
