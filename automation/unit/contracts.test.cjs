const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveTemplate, loadFixtures } = require('../runner/loader.ts');
const { loadSelectors } = require('../runner/selectors.ts');
const { selectCases } = require('../runner/selection.ts');
const { won, positiveQuantity } = require('../pages/commerce.ts');
const root = path.resolve(__dirname, '../..');

function temporary(fn) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loma-contract-')); try { fn(dir); } finally { fs.rmSync(dir, {recursive:true,force:true}); } }
function invalidImport(mutate, expected) {
  temporary((dir) => {
    for (const name of ['scripts','automation','selectors','fixtures','testcases','testcase-management']) fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const before = fs.readFileSync(path.join(dir,'testcases/cart/cart-clear-cancel-keeps-items.yaml'),'utf8');
    mutate(dir);
    const result = spawnSync(process.execPath,[path.join(dir,'scripts/sync-testcases.mjs'),'import'],{encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,expected);
    assert.equal(fs.readFileSync(path.join(dir,'testcases/cart/cart-clear-cancel-keeps-items.yaml'),'utf8'),before,'실패한 import는 기존 생성물을 바꾸면 안 돼');
  });
}
test('fixture 오타와 객체 값은 빈 문자열로 바뀌지 않는다',()=>{
  assert.equal(resolveTemplate('${user.name} ${zero}',{user:{name:'테스트'},zero:0}),'테스트 0');
  assert.throws(()=>resolveTemplate('${user.nmae}',{user:{name:'테스트'}}),/존재하지 않는/);
  assert.throws(()=>resolveTemplate('${user}',{user:{name:'테스트'}}),/치환할 수 없는/);
  assert.throws(()=>resolveTemplate('${toString}',{}),/존재하지 않는/);
});
test('같은 selector 이름은 같은 값이어도 파일 간 덮어쓰지 않는다',()=>temporary(dir=>{
  fs.writeFileSync(path.join(dir,'a.yaml'),'elements:\n  title: {role: heading}\n');
  fs.writeFileSync(path.join(dir,'b.yaml'),'elements:\n  title: {role: heading}\n');
  assert.throws(()=>loadSelectors(dir),/중복 selector 키/);
}));
test('중복 fixture 키도 조용히 덮어쓰지 않는다',()=>temporary(dir=>{
  fs.writeFileSync(path.join(dir,'a.yaml'),'user: {name: A}\n');fs.writeFileSync(path.join(dir,'b.yaml'),'user: {name: B}\n');
  assert.throws(()=>loadFixtures(dir),/중복 fixture 키/);
}));
test('수동과 disabled는 제외, quarantine은 보고 대상과 재검증 대상을 구분한다',()=>{
  const cases=[{id:'A',tags:['smoke'],status:'active'},{id:'Q',tags:['smoke'],status:'quarantine'},{id:'M',status:'manual'},{id:'D',enabled:false}];
  assert.deepEqual(selectCases(cases,['smoke']).map(c=>c.id),['A','Q']);
  assert.deepEqual(selectCases(cases,[],true).map(c=>c.id),['Q']);
  assert.equal(selectCases(cases,['typo']).length,0);
});
test('가격 파서는 할인 음수와 쉼표를 유지하고 모호한 값은 거부한다',()=>{
  assert.equal(won('56,000원'),56000);assert.equal(won('-24,000원'),-24000);
  assert.throws(()=>won('56,000원 80,000원'));assert.throws(()=>won(''));
});
test('수량 기본값은 누락에만 적용하고 0, 음수, 소수, 무한대와 빈 값은 거부한다',()=>{
  assert.equal(positiveQuantity(undefined),1);
  assert.equal(positiveQuantity('2'),2);
  for (const value of ['','0','-1','1.5','Infinity','typo']) assert.throws(()=>positiveQuantity(value),/1 이상의 정수/);
});
test('CSV의 fixture 오타는 생성 전에 차단한다',()=>invalidImport(dir=>{
  const p=path.join(dir,'testcase-management/steps.csv');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('${checkout.guest_orderer.name}','${checkout.typo.name}'));
},/존재하지 않는 fixture 변수/));
test('서로 다른 ID가 같은 YAML 경로를 지정하면 차단한다',()=>invalidImport(dir=>{
  const p=path.join(dir,'testcase-management/test-cases.csv');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('cart/cart-empty-state.yaml','cart/cart-clear-cancel-keeps-items.yaml'));
},/중복 생성 경로/));
test('등록되지 않은 custom action을 실행 전에 차단한다',()=>invalidImport(dir=>{
  const p=path.join(dir,'testcase-management/steps.csv');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('prepare_cart','missing_custom'));
},/custom action/));
test('selector scope 순환 참조는 생성 전에 차단한다',()=>invalidImport(dir=>{
  const p=path.join(dir,'selectors/cycle.yaml');fs.writeFileSync(p,'elements:\n  cycle_a: {role: main, scope: cycle_b}\n  cycle_b: {role: main, scope: cycle_a}\n');
},/순환 참조/));
