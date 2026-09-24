import { expect, test, type Page } from '@playwright/test';

// 이벤트 팝업만 식별해. 주문 확인, 로그인 안내 등 업무용 dialog는 건드리지 않아.
export async function installOverlayHandler(page: Page) {
  const popup = page.getByRole('dialog').filter({
    has: page.getByRole('link', { name: /^이벤트 팝업:/ }),
  }).filter({ has: page.getByRole('button', { name: '오늘 더 보지 않기', exact: true }) });
  // dialog 컨테이너가 크기 0인 사이트 구조도 있어 실제 닫기 버튼을 감지해.
  const close = popup.getByRole('button', { name: '닫기', exact: true });
  let dismissed = 0;
  await page.addLocatorHandler(close, async () => {
    await test.step(`이벤트 팝업 닫기 (${++dismissed}/3)`, async () => {
      await close.click();
      await expect(close).toBeHidden();
      // 닫힘 애니메이션 뒤 배경의 inert가 해제될 때까지 기다려.
      await expect(page.locator('header').locator('xpath=ancestor-or-self::*[@inert]')).toHaveCount(0);
    });
  }, { times: 3 });
}
