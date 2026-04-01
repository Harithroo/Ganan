import { expect, test } from '@playwright/test';

async function openPage(page, pageId) {
  await page.locator(`button[data-page="${pageId}"]`).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
});

test('expense currency input can be cleared and typed', async ({ page }) => {
  await openPage(page, 'add-expense');

  await page.fill('#expenseCurrencyInput', '');
  await expect(page.locator('#expenseCurrencyInput')).toHaveValue('');

  await page.fill('#expenseCurrencyInput', 'usd');
  await expect(page.locator('#expenseCurrencyInput')).toHaveValue('USD');
});

test('conversion currency inputs can be cleared and typed', async ({ page }) => {
  await openPage(page, 'conversions');

  await page.fill('#conversionFromCurrency', '');
  await page.fill('#conversionToCurrency', '');
  await expect(page.locator('#conversionFromCurrency')).toHaveValue('');
  await expect(page.locator('#conversionToCurrency')).toHaveValue('');

  await page.fill('#conversionFromCurrency', 'eur');
  await page.fill('#conversionToCurrency', 'gbp');
  await expect(page.locator('#conversionFromCurrency')).toHaveValue('EUR');
  await expect(page.locator('#conversionToCurrency')).toHaveValue('GBP');
});
