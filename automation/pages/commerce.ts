import { expect, type Page, type Locator } from '@playwright/test';
import { displayedText } from './rendered-text';

export function productTotals(page: Page) { return page.getByRole('main').getByText(/^총\s/).locator('..'); }
export async function productTotal(page: Page) { return won(await displayedText(productTotals(page).locator('number-flow-react').nth(1))); }
export async function assertProductQuantity(page: Page, quantity: number) {
  await expect.poll(() => displayedText(productTotals(page).locator('number-flow-react').nth(0))).toBe(String(quantity));
}

export function won(text: string): number {
  const match = text.trim().match(/^(-?[\d,]+)원$/);
  if (!match) throw new Error(`원화 금액을 읽을 수 없어: ${text}`);
  return Number(match[1].replaceAll(',', ''));
}
export function moneyByLabel(page: Page, label: string): Locator {
  return page.getByRole('main').getByText(label, { exact: true }).locator('..').locator('number-flow-react');
}
export type GuestProduct = { guest_accessible_slug: string; guest_accessible_name: string };
export type CartLine = { product: GuestProduct; quantity: number; unitPrice: number };

export function positiveQuantity(value: string | undefined, fallback = 1): number {
  const quantity = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`수량은 1 이상의 정수여야 해: ${value}`);
  return quantity;
}

export class CommercePage {
  constructor(readonly page: Page, readonly product: GuestProduct) {}
  cartRow() {
    return this.page.getByRole('main').locator('div:has(> button[aria-label="상품 제거"])')
      .filter({ has: this.page.getByRole('link', { name: this.product.guest_accessible_name, exact: true }) });
  }
  async addProduct(quantity = 1, existing: CartLine[] = []) {
    positiveQuantity(String(quantity));
    await this.page.goto(`/product/${this.product.guest_accessible_slug}`, {waitUntil:'domcontentloaded'});
    await expect(this.page.getByRole('main').getByRole('heading', { name: this.product.guest_accessible_name, exact: true })).toBeVisible();
    await assertProductQuantity(this.page, 1);
    await expect.poll(() => productTotal(this.page)).toBeGreaterThan(0);
    const unitPrice = await productTotal(this.page);
    for (let current = 1; current < quantity; current++) {
      await this.page.getByRole('main').getByRole('button', {name:'수량 증가',exact:true}).click();
      await assertProductQuantity(this.page, current + 1);
    }
    await expect.poll(() => productTotal(this.page)).toBe(unitPrice * quantity);
    await this.page.getByRole('button', { name: '장바구니 담기', exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: '장바구니에 담았어요', exact: true });
    // dialog wrapper는 크기가 0일 수 있어. 사용자가 보는 제목과 버튼을 기다려.
    await expect(dialog.getByRole('heading', {name:'장바구니에 담았어요',exact:true})).toBeVisible();
    await dialog.getByRole('button', { name: '장바구니 보기', exact: true }).click();
    await expect(this.page).toHaveURL(/\/cart(?:\?|$)/);
    const previous = existing.find(line => line.product.guest_accessible_slug === this.product.guest_accessible_slug);
    const lines = existing.filter(line => line !== previous);
    if (previous) expect(unitPrice, '재담기 중 상품 판매가가 바뀌면 기준 금액을 다시 확인해야 해.').toBe(previous.unitPrice);
    await this.assertCartContents([...lines, {product:this.product, quantity:quantity + (previous?.quantity ?? 0), unitPrice}]);
    await expect.poll(async () => won(await this.cartRow().locator('p').innerText())).toBe(unitPrice);
    return unitPrice;
  }
  async assertCart(quantity: number, unitPrice?: number) {
    positiveQuantity(String(quantity));
    if (unitPrice !== undefined) {
      await this.assertCartContents([{product:this.product, quantity, unitPrice}]);
      return;
    }
    const row = this.cartRow();
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('link', { name: this.product.guest_accessible_name, exact: true }))
      .toHaveAttribute('href', `/product/${this.product.guest_accessible_slug}`);
    const quantityControl = row.getByRole('button', { name: '수량 증가', exact: true }).locator('..');
    await expect.poll(() => displayedText(quantityControl.locator('number-flow-react'))).toBe(String(quantity));
    await expect.poll(() => displayedText(this.page.getByRole('button', {name:/상품 주문하기$/}))).toBe(`${quantity}개상품주문하기`);
  }
  async assertCartContents(lines: CartLine[]) {
    if (!lines.length) throw new Error('빈 장바구니는 assertEmptyCart로 검증해.');
    await expect(this.page.getByRole('main').locator('div:has(> button[aria-label="상품 제거"])')).toHaveCount(lines.length);
    for (const line of lines) {
      const row = new CommercePage(this.page, line.product).cartRow();
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('link', {name:line.product.guest_accessible_name,exact:true}))
        .toHaveAttribute('href', `/product/${line.product.guest_accessible_slug}`);
      const control = row.getByRole('button', {name:'수량 증가',exact:true}).locator('..');
      await expect.poll(() => displayedText(control.locator('number-flow-react'))).toBe(String(line.quantity));
      await expect.poll(async () => won(await displayedText(row.locator('number-flow-react').last())))
        .toBe(line.unitPrice * line.quantity);
    }
    const quantity = lines.reduce((total, line) => total + line.quantity, 0);
    const total = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
    await expect.poll(() => displayedText(this.page.getByRole('button', {name:/상품 주문하기$/}))).toBe(`${quantity}개상품주문하기`);
    await expect.poll(async () => won(await displayedText(moneyByLabel(this.page, '총 상품 금액')))).toBe(total);
  }
  async assertEmptyCart() {
    const main = this.page.getByRole('main');
    await expect(main.getByText('장바구니가 비어 있습니다.', {exact:false})).toBeVisible();
    await expect(main.locator('div:has(> button[aria-label="상품 제거"])')).toHaveCount(0);
    await expect(main.getByRole('button', {name:/상품 주문하기$/})).toHaveCount(0);
    await expect(main.getByRole('link', {name:'쇼핑하기',exact:true})).toBeVisible();
    await expect(main.getByRole('link', {name:'홈으로',exact:true})).toBeVisible();
  }
  async assertCheckout(unitPrice: number, quantity = 1) {
    positiveQuantity(String(quantity));
    await expect(this.page).toHaveURL(/\/checkout(?:\?|$)/);
    const summary = this.page.getByRole('main').getByRole('complementary');
    await expect(summary.getByRole('link', { name: this.product.guest_accessible_name, exact: true }))
      .toHaveAttribute('href', `/product/${this.product.guest_accessible_slug}`);
    await expect(summary.getByText(`${quantity}개`, { exact: true })).toBeVisible();
    await expect.poll(async () => won(await displayedText(moneyByLabel(this.page, '상품 합계')))).toBe(unitPrice * quantity);
    // 주소, 배송, 할인 적용 전 상품 합계만 비교해. 최종 결제는 실행하지 않아.
    await expect(summary.getByRole('button', { name: /결제하기$/ })).toBeVisible();
  }
}
