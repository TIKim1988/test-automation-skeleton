const {test}=require('node:test');
const assert=require('node:assert/strict');
const {passedTestIds}=require('../ci/sync-failure-issues.js');
const {resolveLocator}=require('../runner/interpreter.ts');
const {resolveTemplate}=require('../runner/loader.ts');

test('이슈는 실제 실행한 모든 프로젝트가 통과한 ID만 닫는다',()=>{
 const specs=[{title:'HOME-001 - pass',tests:[{status:'expected'}]},
 {title:'HOME-002 - skip',tests:[{status:'skipped'}]},
 {title:'HOME-003 - flaky',tests:[{status:'flaky'}]},
 {title:'HOME-004 - mixed',tests:[{status:'expected'},{status:'unexpected'}]}];
 assert.deepEqual([...passedTestIds(specs)],['HOME-001']);
 assert.equal(passedTestIds(specs).has('UNEXECUTED-001'),false);
});
test('통합 셀렉터는 scope, template, exact, index를 유지한다',()=>{
 const calls=[];const fake={getByRole:(role,options)=>{calls.push({role,options});return fake;},nth:i=>{calls.push({index:i});return fake;}};
 const selectors={pages:{},elements:{root:{role:'main'},item:{scope:'root',role:'link',name:'${item.name}',exact:true,index:0}}};
 assert.equal(resolveLocator(fake,selectors,'item',{item:{name:'상품'}}),fake);
 assert.deepEqual(calls,[{role:'main',options:{name:undefined,exact:undefined}},{role:'link',options:{name:'상품',exact:true}},{index:0}]);
});
test('환경변수 지원과 누락 값 오류를 함께 유지한다',()=>{
 process.env.LOMA_MERGE_TEST='example';
 try {assert.equal(resolveTemplate('${env.LOMA_MERGE_TEST}',{}),'example');}
 finally {delete process.env.LOMA_MERGE_TEST;}
 assert.throws(()=>resolveTemplate('${env.LOMA_MERGE_TEST}',{}),/환경변수/);
});
const {renderedText}=require('../pages/rendered-text.ts');
test('애니메이션 숫자는 숨긴 이전 값과 스타일을 제외하고 현재 표시값만 읽는다',()=>{
 const text=s=>({nodeType:3,textContent:s});
 const el=(children=[],attrs={},shadowRoot=null)=>({nodeType:1,tagName:'SPAN',childNodes:children,hasAttribute:k=>Object.hasOwn(attrs,k),shadowRoot});
 const flow=el([],{},el([el([text('9')],{inert:''}),el([text('5')]),text('6,000원')]));
 assert.equal(renderedText(el([flow])),'56,000원');
 assert.equal(renderedText(el([text('총 '),el([],{},el([text('2')])),text(' 개')])),'총2개');
});
