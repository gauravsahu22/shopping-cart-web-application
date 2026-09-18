import { Page, expect, test } from '@playwright/test';

/**
 * End-to-end coverage of the journey a shopper actually takes. Every assertion
 * is on something visible on screen — prices, counts, headings — so the suite
 * fails when the experience breaks, not when the implementation moves.
 */

function money(text: string): number {
  return Number(text.replace(/[^0-9.]/g, ''));
}

async function cartCount(page: Page): Promise<number> {
  return Number(await page.locator('.cart-button__count').innerText());
}

async function addFirstProduct(page: Page): Promise<string> {
  const card = page.locator('app-product-card').first();
  const title = (await card.locator('.product-card__title').innerText()).trim();
  await card.getByRole('button', { name: /add to cart/i }).click();
  return title;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('app-product-card').first()).toBeVisible();
});

test('completes a purchase from catalogue to order confirmation', async ({ page }) => {
  // Browse
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Everything you need');
  const title = await addFirstProduct(page);
  await expect.poll(() => cartCount(page)).toBe(1);

  // Open the cart
  await page.locator('a.cart-button').click();
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();

  const line = page.locator('app-cart-line').first();
  await expect(line).toContainText(title);

  const unitPrice = money(await line.locator('.line__unit').innerText());
  const totalRow = page.locator('.summary-row--total dd');
  expect(money(await totalRow.innerText())).toBeCloseTo(unitPrice, 2);

  // Increase, then decrease
  await line.getByRole('button', { name: /increase quantity/i }).click();
  await expect(line.locator('output')).toHaveText('2');
  expect(money(await totalRow.innerText())).toBeCloseTo(unitPrice * 2, 2);
  await expect.poll(() => cartCount(page)).toBe(2);

  await line.getByRole('button', { name: /decrease quantity/i }).click();
  await expect(line.locator('output')).toHaveText('1');
  expect(money(await totalRow.innerText())).toBeCloseTo(unitPrice, 2);

  // Checkout
  await page.getByRole('link', { name: /proceed to checkout/i }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  const payButton = page.getByRole('button', { name: /^Pay/ });
  expect(money(await payButton.innerText())).toBeCloseTo(unitPrice, 2);

  await page.fill('#fullName', 'Ada Lovelace');
  await page.fill('#email', 'ada@example.com');
  await page.fill('#address', '12 Analytical Way');
  await page.fill('#city', 'London');
  await page.fill('#postcode', 'EC1A 1BB');
  await payButton.click();

  // Order completed
  await expect(page.getByRole('heading', { name: 'Order completed' })).toBeVisible();
  await expect(page.locator('.confirmation__reference')).toHaveText(
    /^KBO-[A-Z2-9]{4}-[A-Z2-9]{4}$/,
  );
  await expect(page.locator('.confirmation__body')).toContainText('Ada Lovelace');
  await expect(page.locator('.confirmation__summary')).toContainText(title);

  // The basket is emptied by a completed order
  await expect.poll(() => cartCount(page)).toBe(0);

  // Continue shopping
  await page.getByRole('link', { name: /continue shopping/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('app-product-card').first()).toBeVisible();
});

test('keeps the basket across a page reload', async ({ page }) => {
  await addFirstProduct(page);
  await expect.poll(() => cartCount(page)).toBe(1);

  await page.reload();
  await expect.poll(() => cartCount(page)).toBe(1);

  await page.goto('/cart');
  await expect(page.locator('app-cart-line')).toHaveCount(1);
});

test('ignores a tampered saved cart instead of breaking', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'kibo.cart.v1',
      JSON.stringify({
        items: [
          { id: 1, title: 'Real', price: 10, image: 'https://x/y.png', category: 'c', quantity: 2 },
          { id: 2, title: 'No price' },
          'not an object',
          { id: 3, title: 'Huge', price: 1, quantity: 999999 },
        ],
      }),
    );
  });
  await page.goto('/cart');

  // The valid line survives, the broken one is dropped, the absurd one is capped.
  await expect(page.locator('app-cart-line')).toHaveCount(2);
  await expect(page.locator('app-cart-line').nth(1).locator('output')).toHaveText('99');
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
});

test('searching, filtering and sorting narrow the catalogue', async ({ page }) => {
  await page.getByRole('button', { name: /^\s*Jewelery/ }).click();
  const titles = page.locator('.product-card__title');
  await expect(titles.first()).toBeVisible();
  for (const category of await page.locator('app-product-card .eyebrow').allInnerTexts()) {
    expect(category.toLowerCase()).toBe('jewelery');
  }

  await page.selectOption('#product-sort', 'price-asc');
  const prices = (await page.locator('.product-card__price').allInnerTexts()).map(money);
  expect([...prices]).toEqual([...prices].sort((a, b) => a - b));

  await page.getByRole('button', { name: /clear filters/i }).click();
  await page.fill('#product-search', 'definitely-not-a-product');
  await expect(page.getByText('No products match your filters')).toBeVisible();
  await expect(page.locator('app-product-card')).toHaveCount(0);
});

test('reveals more products on request', async ({ page }) => {
  await expect(page.locator('.pager__status')).toContainText('Showing');
  const initial = await page.locator('app-product-card').count();

  await page.getByRole('button', { name: /show all/i }).click();
  await expect.poll(() => page.locator('app-product-card').count()).toBeGreaterThan(initial);
  await expect(page.getByRole('button', { name: /load more/i })).toHaveCount(0);
});

test('offers a retry when the catalogue fails to load', async ({ page, context }) => {
  let attempt = 0;
  await context.route('**/products', async (route) => {
    attempt += 1;
    // The HTTP interceptor retries a GET once, so the first two attempts are
    // the same user-visible failure.
    if (attempt <= 2) {
      await route.fulfill({ status: 500, body: 'boom' });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(/trouble|try again/i);

  await page.getByRole('button', { name: /try again/i }).click();
  await expect(page.locator('app-product-card').first()).toBeVisible();
});

test('blocks the confirmation screen without an order', async ({ page }) => {
  await page.goto('/order-completed');
  await expect(page).toHaveURL('/');
});

test('cannot check out with an empty cart or an invalid form', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByText(/nothing to check out/i)).toBeVisible();

  await page.goto('/');
  await addFirstProduct(page);
  await page.goto('/checkout');

  await page.getByRole('button', { name: /^Pay/ }).click();
  await expect(page).toHaveURL(/checkout/);
  await expect(page.locator('#fullName')).toHaveAttribute('aria-invalid', 'true');
  await expect.poll(() => page.locator('.field-error').count()).toBeGreaterThan(0);

  // An invalid email alone is enough to hold the order back.
  await page.fill('#fullName', 'Ada Lovelace');
  await page.fill('#email', 'not-an-email');
  await page.fill('#address', '12 Analytical Way');
  await page.fill('#city', 'London');
  await page.fill('#postcode', 'EC1A 1BB');
  await page.getByRole('button', { name: /^Pay/ }).click();
  await expect(page).toHaveURL(/checkout/);
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
});

test('is navigable with the keyboard alone', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.locator('a.skip-link')).toBeFocused();

  // Reach the basket link by tabbing, then open it with Enter.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.locator('a.cart-button:focus').count()) {
      break;
    }
  }
  await expect(page.locator('a.cart-button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
});
