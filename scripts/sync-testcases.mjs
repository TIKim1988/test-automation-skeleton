import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTCASE_DIR = path.join(ROOT, 'testcases');
const MANAGEMENT_DIR = path.join(ROOT, 'testcase-management');
const TEST_CASES_CSV = path.join(MANAGEMENT_DIR, 'test-cases.csv');
const STEPS_CSV = path.join(MANAGEMENT_DIR, 'steps.csv');
const ACTIONS = new Set([
  'navigate', 'click', 'fill', 'select', 'check', 'uncheck',
  'assert_visible', 'assert_hidden', 'assert_text', 'wait', 'custom',
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.ya?ml$/i.test(entry.name) ? [full] : [];
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => csvEscape(row[header])))]
    .map((row) => row.join(','))
    .join('\n') + '\n';
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted) {
      if (char === '"' && raw[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV의 큰따옴표가 닫히지 않았습니다.');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const [headers, ...data] = rows.filter((cells) => cells.some((cell) => cell.trim()));
  if (!headers) return [];
  return data.map((cells, rowIndex) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
    .map((row, index) => ({ ...row, __row: index + 2 }));
}

function required(row, field, label) {
  const value = row[field]?.trim();
  if (!value) throw new Error(`${label} ${row.__row}행: ${field} 값이 필요합니다.`);
  return value;
}

function splitTags(value) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function bool(value, label) {
  const normalized = value.trim().toLowerCase();
  if (['', 'true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  throw new Error(`${label}: enabled는 true 또는 false여야 합니다.`);
}

function validatePath(relativePath, label) {
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\.ya?ml$/i.test(relativePath) || relativePath.includes('..')) {
    throw new Error(`${label}: path는 예를 들어 search/search-with-results.yaml 형식이어야 합니다.`);
  }
}

function loadSelectors() {
  const pages = new Set();
  const elements = new Set();
  for (const file of walk(path.join(ROOT, 'selectors'))) {
    const doc = yaml.load(fs.readFileSync(file, 'utf8')) ?? {};
    Object.keys(doc.pages ?? {}).forEach((key) => pages.add(key));
    Object.keys(doc.elements ?? {}).forEach((key) => elements.add(key));
  }
  return { pages, elements };
}

function validateRows(testCases, steps) {
  const errors = [];
  const byId = new Map();
  const selectors = loadSelectors();
  for (const testCase of testCases) {
    try {
      const id = required(testCase, 'id', 'TestCases');
      if (byId.has(id)) throw new Error(`TestCases ${testCase.__row}행: id ${id}가 중복됩니다.`);
      required(testCase, 'title', 'TestCases');
      validatePath(required(testCase, 'path', 'TestCases'), `TestCases ${testCase.__row}행`);
      const status = testCase.status.trim() || 'active';
      if (!['active', 'quarantine', 'manual'].includes(status)) throw new Error(`TestCases ${testCase.__row}행: status는 active, quarantine, manual 중 하나여야 합니다.`);
      const priority = testCase.priority.trim() || 'P2';
      if (!['P1', 'P2', 'P3'].includes(priority)) throw new Error(`TestCases ${testCase.__row}행: priority는 P1, P2, P3 중 하나여야 합니다.`);
      bool(testCase.enabled, `TestCases ${testCase.__row}행`);
      byId.set(id, testCase);
    } catch (error) {
      errors.push(error.message);
    }
  }

  const grouped = new Map();
  for (const step of steps) {
    try {
      const testCaseId = required(step, 'testcase_id', 'Steps');
      if (!byId.has(testCaseId)) throw new Error(`Steps ${step.__row}행: 존재하지 않는 testcase_id ${testCaseId}를 참조합니다.`);
      const stepNo = Number(required(step, 'step_no', 'Steps'));
      if (!Number.isInteger(stepNo) || stepNo < 1) throw new Error(`Steps ${step.__row}행: step_no는 1 이상의 정수여야 합니다.`);
      const action = required(step, 'action', 'Steps');
      if (!ACTIONS.has(action)) throw new Error(`Steps ${step.__row}행: 지원하지 않는 action ${action}입니다.`);
      const target = step.target.trim();
      if (['wait', 'custom'].includes(action) === false && !target) throw new Error(`Steps ${step.__row}행: ${action} action에는 target이 필요합니다.`);
      if (action === 'navigate' && target && !selectors.pages.has(target)) throw new Error(`Steps ${step.__row}행: page target ${target}이 selectors에 없습니다.`);
      if (!['navigate', 'wait', 'custom'].includes(action) && target && !selectors.elements.has(target)) throw new Error(`Steps ${step.__row}행: element target ${target}이 selectors에 없습니다.`);
      if (action === 'custom' && !step.name.trim()) throw new Error(`Steps ${step.__row}행: custom action에는 name이 필요합니다.`);
      if (action === 'wait' && step.timeout_ms.trim() && !Number.isFinite(Number(step.timeout_ms))) throw new Error(`Steps ${step.__row}행: timeout_ms는 숫자여야 합니다.`);
      const group = grouped.get(testCaseId) ?? [];
      group.push({ ...step, stepNo });
      grouped.set(testCaseId, group);
    } catch (error) {
      errors.push(error.message);
    }
  }

  for (const [id, testCase] of byId) {
    const group = (grouped.get(id) ?? []).sort((a, b) => a.stepNo - b.stepNo);
    if (group.length === 0) errors.push(`TestCases ${testCase.__row}행: ${id}에 스텝이 없습니다.`);
    group.forEach((step, index) => {
      if (step.stepNo !== index + 1) errors.push(`Steps ${step.__row}행: ${id}의 step_no는 1부터 연속된 값이어야 합니다.`);
    });
  }
  if (errors.length) throw new Error(`테스트케이스 검증 실패:\n- ${errors.join('\n- ')}`);
  return { byId, grouped };
}

function documentFor(testCase, steps) {
  const doc = {
    id: testCase.id.trim(),
    title: testCase.title.trim(),
    tags: splitTags(testCase.tags),
    priority: (testCase.priority.trim() || 'P2'),
    status: (testCase.status.trim() || 'active'),
    enabled: bool(testCase.enabled, `TestCases ${testCase.__row}행`),
    ...(testCase.precondition.trim() ? { precondition: testCase.precondition.trim() } : {}),
    ...(testCase.last_verified.trim() ? { last_verified: testCase.last_verified.trim() } : {}),
    steps: steps.sort((a, b) => a.stepNo - b.stepNo).map((step) => ({
      action: step.action.trim(),
      ...(step.target.trim() ? { target: step.target.trim() } : {}),
      ...(step.value.trim() ? { value: step.value } : {}),
      ...(step.timeout_ms.trim() ? { timeoutMs: Number(step.timeout_ms) } : {}),
      ...(step.name.trim() ? { name: step.name.trim() } : {}),
      ...(step.params.trim() ? { params: JSON.parse(step.params) } : {}),
    })),
  };
  return yaml.dump(doc, { lineWidth: -1, noRefs: true, quotingType: '"' });
}

function exportCsv() {
  const testCases = [];
  const steps = [];
  for (const file of walk(TESTCASE_DIR).sort()) {
    const doc = yaml.load(fs.readFileSync(file, 'utf8'));
    const relativePath = path.relative(TESTCASE_DIR, file);
    testCases.push({
      id: doc.id,
      title: doc.title,
      path: relativePath,
      tags: (doc.tags ?? []).join(','),
      priority: doc.priority ?? ((doc.tags ?? []).includes('smoke') ? 'P1' : 'P2'),
      status: doc.status ?? 'active',
      enabled: doc.enabled ?? true,
      precondition: doc.precondition ?? '',
      last_verified: doc.last_verified ?? '',
    });
    (doc.steps ?? []).forEach((step, index) => steps.push({
      testcase_id: doc.id,
      step_no: index + 1,
      action: step.action,
      target: step.target ?? '',
      value: step.value ?? '',
      timeout_ms: step.timeoutMs ?? '',
      name: step.name ?? '',
      params: step.params ? JSON.stringify(step.params) : '',
    }));
  }
  fs.mkdirSync(MANAGEMENT_DIR, { recursive: true });
  fs.writeFileSync(TEST_CASES_CSV, toCsv(['id', 'title', 'path', 'tags', 'priority', 'status', 'enabled', 'precondition', 'last_verified'], testCases));
  fs.writeFileSync(STEPS_CSV, toCsv(['testcase_id', 'step_no', 'action', 'target', 'value', 'timeout_ms', 'name', 'params'], steps));
  console.log(`Exported ${testCases.length} test cases and ${steps.length} steps to testcase-management/.`);
}

function importCsv(checkOnly) {
  const testCases = parseCsv(fs.readFileSync(TEST_CASES_CSV, 'utf8'));
  const steps = parseCsv(fs.readFileSync(STEPS_CSV, 'utf8'));
  const { byId, grouped } = validateRows(testCases, steps);
  const expectedPaths = new Set();
  const changed = [];
  for (const [id, testCase] of byId) {
    const relativePath = testCase.path.trim();
    const outputPath = path.join(TESTCASE_DIR, relativePath);
    expectedPaths.add(path.normalize(outputPath));
    const content = documentFor(testCase, grouped.get(id) ?? []);
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : undefined;
    if (current !== content) {
      changed.push(path.relative(ROOT, outputPath));
      if (!checkOnly) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content);
      }
    }
  }
  const stale = walk(TESTCASE_DIR).filter((file) => !expectedPaths.has(path.normalize(file))).map((file) => path.relative(ROOT, file));
  if (stale.length) throw new Error(`스프레드시트에 없는 YAML이 남아 있습니다. 삭제는 자동으로 하지 않습니다:\n- ${stale.join('\n- ')}`);
  if (checkOnly && changed.length) throw new Error(`CSV 원본과 생성된 YAML이 일치하지 않습니다. npm run testcases:import 를 실행하세요:\n- ${changed.join('\n- ')}`);
  console.log(`${checkOnly ? 'Validated' : 'Generated'} ${byId.size} test cases${changed.length ? ` (${changed.length} file(s) changed)` : ''}.`);
}

const [command, flag] = process.argv.slice(2);
if (command === 'export') exportCsv();
else if (command === 'import') importCsv(flag === '--check');
else {
  console.error('Usage: node scripts/sync-testcases.mjs <export|import> [--check]');
  process.exitCode = 1;
}
