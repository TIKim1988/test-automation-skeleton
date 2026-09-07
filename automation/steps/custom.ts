import { expect, test } from '@playwright/test';
import type { CustomStepFn } from '../runner/interpreter';
import { CommercePage, won } from '../pages/commerce';

export const customSteps: Record<string, CustomStepFn> = {
  capture_product_price: async (page, _step, ctx) => {
    ctx.unitPrice = won(await page.getByText('총 1개', {exact:true}).locator('..').getByText(/^[\d,]+원$/).innerText());
  },
  assert_product_price: async (page, step, ctx) => {
    const quantity = Number(step.value);
    if (typeof ctx.unitPrice !== 'number' || !Number.isInteger(quantity) || quantity < 1) throw new Error('기준 가격과 수량이 필요해.');
    await expect.poll(async () => won(await page.getByText(`총 ${quantity}개`, {exact:true}).locator('..').getByText(/^[\d,]+원$/).innerText())).toBe(ctx.unitPrice * quantity);
  },
  prepare_cart: async (page, _step, ctx) => {
    const commerce = new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]);
    ctx.unitPrice = await commerce.addProduct();
    await commerce.assertCart(1, ctx.unitPrice as number);
  },
  assert_cart: async (page, step, ctx) => {
    const quantity = Number(step.value ?? '1');
    if (!Number.isInteger(quantity) || quantity < 1 || typeof ctx.unitPrice !== 'number') throw new Error('장바구니 수량과 기준 가격이 필요해.');
    await new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]).assertCart(quantity, ctx.unitPrice);
  },
  assert_checkout: async (page, _step, ctx) => {
    if (typeof ctx.unitPrice !== 'number') throw new Error('장바구니 준비 가격이 없어.');
    await new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]).assertCheckout(ctx.unitPrice);
  },
  assert_search_results: async (page, _step, ctx) => {
    const keyword = (ctx.search as {keyword_with_results:string}).keyword_with_results;
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === keyword);
    const product = ctx.product as {guest_accessible_slug:string};
    await expect(page.getByRole('main').locator(`article a[href="/product/${product.guest_accessible_slug}"]`)).toBeVisible();
  },
  assert_empty_search: async (page, _step, ctx) => {
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === (ctx.search as {keyword_no_match:string}).keyword_no_match);
    await expect(page.getByRole('main').getByRole('heading', {name:'검색 결과가 없습니다.', exact:true})).toBeVisible();
    await expect(page.getByRole('main').locator('article')).toHaveCount(0);
    await expect(page.getByRole('main').getByText('0개 상품', {exact:true})).toBeVisible();
  },
  assert_product_list: async (page) => {
    await expect.poll(() => page.getByRole('main').locator('article').count()).toBeGreaterThan(0);
  },
  assert_sorted_prices: async (page, step) => {
    const descending = step.value === 'desc';
    let observed: {text:string; price:number}[] = [];
    try {
    await expect.poll(async () => {
      const cards = page.getByRole('main').locator('article');
      const texts = await cards.allInnerTexts();
      if (texts.length < 2) return false;
      const prices = texts.map((text) => {
        const match = text.match(/[\d,]+원/);
        if (!match) throw new Error(`상품 판매가를 읽을 수 없어: ${text}`);
        return won(match[0]);
      });
      observed = texts.map((text, i) => ({text, price: prices[i]}));
      // 판매가 두 종류 이상인 데이터여야 미정렬 목록이 우연히 통과하는 걸 막을 수 있어.
      return new Set(prices).size > 1 && prices.every((price, i) => i === 0 || (descending ? prices[i - 1] >= price : prices[i - 1] <= price));
    }, { message: '화면에 표시된 상품 판매가가 선택한 순서로 정렬되어야 해.' }).toBe(true);
    } catch (error) {
      await test.info().attach('displayed-price-order', {body: JSON.stringify({url:page.url(), direction:step.value, products:observed}, null, 2), contentType:'application/json'});
      throw error;
    }
  },
};
