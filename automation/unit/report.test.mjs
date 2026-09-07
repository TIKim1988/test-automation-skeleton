import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarize, renderSummary } from '../../scripts/summarize-results.mjs';
const base = { stats: {expected:1,unexpected:0,flaky:0,skipped:0}, suites:[] };
test('정상 실행은 통과로 집계한다',()=>assert.equal(summarize(base).ok,true));
test('재시도 통과는 최종 실패와 분리하고 첫 실패 근거를 남긴다',()=>{
  const result=summarize({stats:{expected:0,unexpected:0,flaky:1,skipped:0},suites:[{specs:[{title:'재시도 사례',tests:[{status:'flaky',projectName:'chromium',results:[{status:'failed',retry:0,error:{message:'<script>alert(1)</script>'}},{status:'passed',retry:1}]}]}]}]});
  assert.equal(result.failed,0);assert.equal(result.flaky,1);assert.equal(result.ok,false);
  assert.equal(result.entries[0].attempts.length,2);
  const html=renderSummary(result);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('테스트가 모두 통과해도 전역 실행 오류가 있으면 실패한다',()=>{
  const result=summarize({...base,errors:[{message:'global teardown failed'}]});assert.equal(result.ok,false);assert.equal(result.errors.length,1);
});
test('프로젝트별 실패를 마지막 프로젝트 성공으로 덮어쓰지 않는다',()=>{
  const result=summarize({stats:{expected:1,unexpected:1,flaky:0,skipped:0},suites:[{specs:[{title:'같은 TC',tests:[{status:'unexpected',projectName:'webkit',results:[{status:'failed',error:{message:'failed on webkit'}}]},{status:'expected',projectName:'chromium',results:[{status:'passed'}]}]}]}]});
  assert.equal(result.entries[0].project,'webkit');assert.equal(result.failed,1);
});
test('빈 실행과 전체 skip을 성공으로 보고하지 않는다',()=>{
  for(const stats of [{expected:0,unexpected:0,flaky:0,skipped:0},{expected:0,unexpected:0,flaky:0,skipped:3}]) assert.equal(summarize({stats}).ok,false);
});
test('핵심 P1 skip이 있으면 다른 TC가 통과해도 게이트를 실패시킨다',()=>{
  const result=summarize({...base,suites:[{specs:[{title:'P1',tests:[{status:'skipped',annotations:[{type:'priority',description:'P1'}],results:[]}]}]}]});assert.equal(result.ok,false);
});
test('결과 JSON 부재와 손상은 요약 파일을 남기고 비정상 종료한다',()=>{
  for(const content of [undefined,'broken-json']) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loma-report-'));
    try {
      if(content)fs.writeFileSync(path.join(dir,'results.json'),content);
      const run=spawnSync(process.execPath,[path.resolve('scripts/summarize-results.mjs')],{env:{...process.env,PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(dir,'results.json'),GITHUB_OUTPUT:path.join(dir,'outputs')},encoding:'utf8'});
      assert.equal(run.status,1);assert.match(fs.readFileSync(path.join(dir,'email-summary.html'),'utf8'),/결과 파일 읽기 실패/);assert.match(fs.readFileSync(path.join(dir,'outputs'),'utf8'),/ok=false/);
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
  }
});
