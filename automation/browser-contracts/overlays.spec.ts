import { test, expect, type Page } from '@playwright/test';
import { installOverlayHandler } from '../pages/overlays';
async function setup(page: Page) {
  await page.setContent(`<div id="background"><header><button onclick="this.textContent='완료'">작업</button></header></div>`);
  await installOverlayHandler(page);
}
async function popup(page: Page, delay = 0) {
  await page.evaluate((delay) => {
    const show = () => {
      document.querySelector('#background')!.setAttribute('inert','');
      const dialog = document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.style.cssText='width:0;height:0;overflow:visible';
      dialog.innerHTML='<a href="#" aria-label="이벤트 팝업: 임의 행사">행사</a><button>오늘 더 보지 않기</button><button id="close">닫기</button>';
      document.body.append(dialog);
      dialog.querySelector('#close')!.addEventListener('click',()=>{dialog.remove();setTimeout(()=>document.querySelector('#background')!.removeAttribute('inert'),100);});
    };
    if(delay) setTimeout(show,delay); else show();
  }, delay);
}
test('팝업 없음, 원래 동작 유지',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'작업',exact:true}).click();await expect(page.getByRole('button',{name:'완료'})).toBeVisible();
});
test('지연 팝업과 반복 노출 뒤 실제 동작 수행',async({page})=>{
 await setup(page); await page.getByRole('button',{name:'작업',exact:true}).evaluate(e=>(e as HTMLButtonElement).disabled=true);
 await popup(page,50);
 await page.evaluate(()=>setTimeout(()=>{(document.querySelector('header button') as HTMLButtonElement).disabled=false;},150));
 await page.getByRole('button',{name:'작업',exact:true}).click();await expect(page.getByRole('button',{name:'완료'})).toBeVisible();
 await popup(page);await expect(page.getByRole('button',{name:'완료'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('업무용 확인창은 닫지 않음',async({page})=>{
 await setup(page);await page.evaluate(()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<h2>삭제 확인</h2><button>닫기</button>';document.body.append(d);});
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('heading',{name:'삭제 확인'})).toBeVisible();
});
test('네 번째 반복 팝업은 오류로 남김',async({page})=>{
 await setup(page);for(let i=0;i<3;i++){await popup(page);await expect(page.getByRole('button',{name:'작업',exact:true})).toBeVisible();}
 await popup(page);await expect(page.getByRole('button',{name:'작업',exact:true}).click({timeout:2000})).rejects.toThrow(/Timeout|timeout/);
 await expect(page.getByRole('button',{name:'닫기',exact:true})).toBeVisible();
});
