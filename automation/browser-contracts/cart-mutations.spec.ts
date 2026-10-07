import { test, expect } from '@playwright/test';
import { cartMutation } from '../pages/cart-mutations';

for (const method of ['PATCH','DELETE'] as const) {
  test(`${method} 저장이 지연돼도 응답 완료 후 새로고침하면 서버 상태가 유지된다`, async ({page}) => {
    let quantity = 1;
    const updated = method === 'PATCH' ? 2 : 0;
    await page.route('https://cart.test/', route => route.fulfill({contentType:'text/html',body:
      `<main><output>${quantity}</output><button onclick="document.querySelector('output').textContent='${updated}';fetch('/api/cart',{method:'${method}'})">save</button></main>`}));
    await page.route('https://cart.test/api/cart', async route => {
      await new Promise(resolve => setTimeout(resolve, 200));
      quantity = updated;
      await route.fulfill({json:{quantity}});
    });
    await page.goto('https://cart.test/');
    await cartMutation(page, method, () => page.getByRole('button', {name:'save'}).click());
    await page.reload();
    await expect(page.locator('output')).toHaveText(String(updated));
  });
}

test('장바구니 저장 서버 오류는 화면의 낙관적 성공 표시와 무관하게 실패한다', async ({page}) => {
  await page.route('https://cart.test/', route => route.fulfill({contentType:'text/html',body:
    '<button onclick="this.textContent=\'saved\';fetch(\'/api/cart\',{method:\'PATCH\'})">save</button>'}));
  await page.route('https://cart.test/api/cart', route => route.fulfill({status:500,json:{error:'save failed'}}));
  await page.goto('https://cart.test/');
  await expect(cartMutation(page, 'PATCH', () => page.getByRole('button', {name:'save'}).click())).rejects.toThrow('장바구니 PATCH 저장 응답: 500');
});
