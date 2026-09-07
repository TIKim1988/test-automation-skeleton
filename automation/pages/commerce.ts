import { expect, type Page, type Locator } from '@playwright/test';

export function won(text: string): number {
  const match = text.trim().match(/^(-?[\d,]+)원$/);
  if (!match) throw new Error(`원화 금액을 읽을 수 없어: ${text}`);
  return Number(match[1].replaceAll(',', ''));
}
export function moneyByLabel(page: Page, label: string): Locator {
  return page.getByRole('main').getByText(label, { exact: true }).locator('..').getByText(/^-?[\d,]+원$/);
}
export class CommercePage {
  constructor(readonly page: Page, readonly product: { guest_accessible_slug: string; guest_accessible_name: string }) {}
  cartRow() {
    return this.page.getByRole('main').locator('div:has(> button[aria-label="상품 제거"])')
      .filter({ has: this.page.getByRole('link', { name: this.product.guest_accessible_name, exact: true }) });
  }
  async addProduct() {
    await this.page.goto(`/product/${this.product.guest_accessible_slug}`);
    await expect(this.page.getByRole('main').getByRole('heading', { name: this.product.guest_accessible_name, exact: true })).toBeVisible();
    await expect(this.page.getByText('총 1개', { exact: true })).toBeVisible();
    const unitPrice = won(await this.page.getByText('총 1개', { exact: true }).locator('..').getByText(/^[\d,]+원$/).innerText());
    await this.page.getByRole('button', { name: '장바구니 담기', exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: '장바구니에 담았어요', exact: true });
    // dialog wrapper는 크기가 0일 수 있어. 사용자가 보는 제목과 버튼을 기다려.
    await expect(dialog.getByRole('heading', {name:'장바구니에 담았어요',exact:true})).toBeVisible();
    await dialog.getByRole('button', { name: '장바구니 보기', exact: true }).click();
    await expect(this.page).toHaveURL(/\/cart(?:\?|$)/);
    await this.assertCart(1, unitPrice);
    await expect.poll(async () => won(await this.cartRow().locator('p').innerText())).toBe(unitPrice);
    return unitPrice;
  }
  async assertCart(quantity: number, unitPrice?: number) {
    const row = this.cartRow();
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('link', { name: this.product.guest_accessible_name, exact: true }))
      .toHaveAttribute('href', `/product/${this.product.guest_accessible_slug}`);
    const quantityControl = row.getByRole('button', { name: '수량 증가', exact: true }).locator('..');
    await expect(quantityControl.getByText(String(quantity), { exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: `${quantity}개 상품 주문하기`, exact: true })).toBeVisible();
    if (unitPrice !== undefined) {
      await expect.poll(async () => won(await moneyByLabel(this.page, '총 상품 금액').innerText())).toBe(unitPrice * quantity);
      const amounts = row.locator('span').filter({ hasText: /^[\d,]+원$/ });
      await expect(amounts.filter({ hasText: new RegExp(`^${(unitPrice * quantity).toLocaleString('en-US')}원$`) })).toHaveCount(1);
    }
  }
  async assertCheckout(unitPrice: number) {
    await expect(this.page).toHaveURL(/\/checkout(?:\?|$)/);
    const summary = this.page.getByRole('main').getByRole('complementary');
    await expect(summary.getByRole('link', { name: this.product.guest_accessible_name, exact: true }))
      .toHaveAttribute('href', `/product/${this.product.guest_accessible_slug}`);
    await expect(summary.getByText('1개', { exact: true })).toBeVisible();
    await expect.poll(async () => won(await moneyByLabel(this.page, '상품 합계').innerText())).toBe(unitPrice);
    // 주소, 배송, 할인 적용 전 상품 합계만 비교해. 최종 결제는 실행하지 않아.
    await expect(summary.getByRole('button', { name: /^총 [\d,]+원 결제하기$/ })).toBeVisible();
  }
}
