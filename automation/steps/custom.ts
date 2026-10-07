import { expect, test } from '@playwright/test';
import type { CustomStepFn } from '../runner/interpreter';
import { CommercePage, won, productTotal, assertProductQuantity, positiveQuantity, type CartLine, type GuestProduct } from '../pages/commerce';
import { cartMutation } from '../pages/cart-mutations';

export const customSteps: Record<string, CustomStepFn> = {
  open_home_banner: async (page) => {
    await page.getByRole('button', {name:'1번 슬라이드로 이동', exact:true}).click();
    const link = page.getByRole('region', {name:'이벤트 배너', exact:true}).getByRole('link').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    if (!href || !/^\/(event|product|brand-category)\//.test(href)) throw new Error('배너 목적지 경로가 유효하지 않아.');
    await link.click();
    await expect(page).toHaveURL(new URL(href, page.url()).href);
    await expect(page.getByRole('main')).toBeVisible();
  },
  open_home_product: async (page) => {
    const link = page.getByRole('tabpanel', {name:'헬스케어', exact:true}).getByRole('link', {name:/로마 베이브/});
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    if (!href || !href.startsWith('/product/')) throw new Error('인기상품 목적지가 유효하지 않아.');
    await link.click();
    await expect(page).toHaveURL(new URL(href, page.url()).href);
    await expect(page.getByRole('main').getByRole('heading', {name:'로마 베이브', exact:true})).toBeVisible();
  },
  capture_product_price: async (page, _step, ctx) => {
    await assertProductQuantity(page, 1);
    ctx.unitPrice = await productTotal(page);
  },
  assert_product_price: async (page, step, ctx) => {
    const quantity = Number(step.value);
    if (typeof ctx.unitPrice !== 'number' || !Number.isInteger(quantity) || quantity < 1) throw new Error('기준 가격과 수량이 필요해.');
    await assertProductQuantity(page, quantity);
    await expect.poll(() => productTotal(page)).toBe(ctx.unitPrice * quantity);
  },
  prepare_cart: async (page, step, ctx) => {
    const commerce = new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]);
    const quantity = positiveQuantity(step.value);
    ctx.unitPrice = await commerce.addProduct(quantity);
    await commerce.assertCart(quantity, ctx.unitPrice as number);
  },
  add_same_product: async (page, _step, ctx) => {
    if (typeof ctx.unitPrice !== 'number') throw new Error('기존 장바구니 기준 가격이 없어.');
    const product = ctx.product as GuestProduct;
    await new CommercePage(page, product).addProduct(1, [{product,quantity:1,unitPrice:ctx.unitPrice}]);
  },
  prepare_two_product_cart: async (page, _step, ctx) => {
    const first = ctx.product as GuestProduct;
    const second = ctx.secondary_product as GuestProduct;
    const unitPrice = await new CommercePage(page, first).addProduct();
    const firstLine = {product:first,quantity:1,unitPrice};
    const secondPrice = await new CommercePage(page, second).addProduct(1, [firstLine]);
    ctx.cartLines = [firstLine, {product:second,quantity:1,unitPrice:secondPrice}];
  },
  remove_primary_cart_item: async (page, _step, ctx) => {
    await new CommercePage(page, ctx.product as GuestProduct).cartRow().getByRole('button', {name:'상품 제거',exact:true}).click();
    await cartMutation(page, 'DELETE', () => page.getByRole('button', {name:'빼기',exact:true}).click());
  },
  change_cart_quantity: async (page, step, ctx) => {
    if (step.value !== 'increase' && step.value !== 'decrease') throw new Error('장바구니 수량 방향은 increase 또는 decrease여야 해.');
    const button = new CommercePage(page, ctx.product as GuestProduct).cartRow().getByRole('button', {
      name:step.value === 'increase' ? '수량 증가' : '수량 감소',exact:true,
    });
    await cartMutation(page, 'PATCH', () => button.click());
  },
  confirm_cart_clear: async (page) => {
    await cartMutation(page, 'DELETE', () => page.getByRole('button', {name:'비우기',exact:true}).click());
  },
  confirm_cart_remove: async (page) => {
    await cartMutation(page, 'DELETE', () => page.getByRole('button', {name:'빼기',exact:true}).click());
  },
  assert_secondary_cart: async (page, _step, ctx) => {
    const lines = ctx.cartLines as CartLine[] | undefined;
    if (!lines || lines.length !== 2) throw new Error('서로 다른 두 상품의 준비 기록이 필요해.');
    const commerce = new CommercePage(page, ctx.product as GuestProduct);
    await expect(commerce.cartRow()).toHaveCount(0);
    await commerce.assertCartContents([lines[1]]);
  },
  assert_empty_cart: async (page, _step, ctx) => {
    await new CommercePage(page, ctx.product as GuestProduct).assertEmptyCart();
  },
  reload_page: async (page) => {
    await page.reload({waitUntil:'domcontentloaded'});
  },
  return_to_cart: async (page) => {
    await page.goBack({waitUntil:'domcontentloaded'});
    await expect(page).toHaveURL(/\/cart(?:\?|$)/);
  },
  open_search_product: async (page, _step, ctx) => {
    const product = ctx.product as GuestProduct;
    await page.getByRole('main').locator(`article a[href="/product/${product.guest_accessible_slug}"]`).click();
    await expect(page).toHaveURL((url) => url.pathname === `/product/${product.guest_accessible_slug}`);
    await expect(page.getByRole('main').getByRole('heading', {name:product.guest_accessible_name,exact:true})).toBeVisible();
  },
  search_for: async (page, step) => {
    if (!step.value?.trim()) throw new Error('검색어가 필요해.');
    const header = page.getByRole('banner');
    const input = header.getByRole('searchbox', {name:'상품 검색',exact:true});
    if (!await input.isVisible()) await header.getByRole('button', {name:'검색',exact:true}).click();
    await input.fill(step.value);
    await header.getByRole('button', {name:'검색',exact:true}).click();
    await expect(page).toHaveURL(url => url.pathname === '/search' && url.searchParams.get('q') === step.value);
    await expect(page.getByRole('heading', {name:'상품검색',exact:true})).toBeVisible();
  },
  assert_cart: async (page, step, ctx) => {
    const quantity = Number(step.value ?? '1');
    if (!Number.isInteger(quantity) || quantity < 1 || typeof ctx.unitPrice !== 'number') throw new Error('장바구니 수량과 기준 가격이 필요해.');
    await new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]).assertCart(quantity, ctx.unitPrice);
  },
  assert_checkout: async (page, step, ctx) => {
    if (typeof ctx.unitPrice !== 'number') throw new Error('장바구니 준비 가격이 없어.');
    await new CommercePage(page, ctx.product as ConstructorParameters<typeof CommercePage>[1]).assertCheckout(ctx.unitPrice, positiveQuantity(step.value));
  },
  assert_search_results: async (page, step, ctx) => {
    const keyword = step.value ?? (ctx.search as {keyword_with_results:string}).keyword_with_results;
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === keyword);
    const product = ctx.product as {guest_accessible_slug:string};
    await expect(page.getByRole('main').locator(`article a[href="/product/${product.guest_accessible_slug}"]`)).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', {name:'검색 결과가 없습니다.',exact:true})).toHaveCount(0);
    if (step.params?.count !== undefined) {
      const count = positiveQuantity(String(step.params.count));
      await expect(page.getByRole('main').locator('article')).toHaveCount(count);
    }
  },
  assert_empty_search: async (page, _step, ctx) => {
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === (ctx.search as {keyword_no_match:string}).keyword_no_match);
    await expect(page.getByRole('main').getByRole('heading', {name:'검색 결과가 없습니다.', exact:true})).toBeVisible();
    await expect(page.getByRole('main').locator('article')).toHaveCount(0);
    // 결과 없음 heading과 상품 0개를 함께 검증해 로딩 중 빈 상태 통과를 막아.
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
