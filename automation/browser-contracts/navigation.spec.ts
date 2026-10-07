import { test, expect } from '@playwright/test';
import { runTestCase } from '../runner/interpreter';

test('본문을 읽을 수 있으면 지연 이미지의 load 완료 없이 다음 검증을 실행한다', async ({page}) => {
  await page.route('https://navigation.test/', route => route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><main><h1>준비 완료</h1><img src="/pending.png"></main>'}));
  await page.route('https://navigation.test/pending.png', async route => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.abort().catch(() => {});
  });
  page.setDefaultNavigationTimeout(1500);
  await runTestCase(page, {id:'NAV-001',title:'본문 준비',file:__filename,steps:[{action:'navigate',target:'sample'},{action:'assert_visible',target:'heading'}]},
    {pages:{sample:'https://navigation.test/'},elements:{heading:{role:'heading',name:'준비 완료',exact:true}}},{});
  await expect(page.getByRole('heading', {name:'준비 완료'})).toBeVisible();
});
