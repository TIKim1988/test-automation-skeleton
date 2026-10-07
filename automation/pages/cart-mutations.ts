import { expect, type Page } from '@playwright/test';

// 장바구니 UI는 응답 전에 바뀔 수 있어. 이동과 새로고침 전에 해당 저장 요청의 완료를 확인해.
export async function cartMutation(page: Page, method: 'PATCH' | 'DELETE', action: () => Promise<unknown>) {
  const origin = new URL(page.url()).origin;
  const [response] = await Promise.all([
    page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === origin && (url.pathname === '/api/cart' || url.pathname.startsWith('/api/cart/'))
        && response.request().method() === method;
    }, {timeout:10_000}),
    action(),
  ]);
  expect(response.ok(), `장바구니 ${method} 저장 응답: ${response.status()}`).toBe(true);
  expect(await response.finished(), '장바구니 저장 응답을 끝까지 받아야 해.').toBeNull();
}
