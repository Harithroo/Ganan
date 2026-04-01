import { expect, test } from '@playwright/test';

async function openPage(page, pageId) {
  await page.locator(`button[data-page="${pageId}"]`).click();
}

async function addPerson(page, name) {
  await page.fill('#personInput', name);
  await page.click('#addPersonBtn');
}

async function addExpense(page, { payer, amount, beneficiaries }) {
  await page.selectOption('#payerSelect', payer);
  await page.fill('#amountInput', String(amount));
  await page.fill('#descriptionInput', `${payer} expense ${amount}`);

  const beneficiarySet = new Set(beneficiaries);
  const count = await page.locator('.beneficiary-checkbox').count();
  for (let i = 0; i < count; i += 1) {
    const checkbox = page.locator('.beneficiary-checkbox').nth(i);
    const value = await checkbox.getAttribute('value');
    await checkbox.setChecked(beneficiarySet.has(value));
  }

  await page.click('#submitExpenseBtn');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
});

test('renaming a person to an existing name confirms and merges', async ({ page }) => {
  await openPage(page, 'people');
  await addPerson(page, 'Alice');
  await addPerson(page, 'Bob');

  await openPage(page, 'add-expense');
  await addExpense(page, { payer: 'Alice', amount: 120, beneficiaries: ['Alice', 'Bob'] });

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('Bob');
      return;
    }
    if (dialog.type() === 'confirm') {
      await dialog.accept();
    }
  });

  await openPage(page, 'people');
  await page.locator('[data-action="rename-person"][data-person="Alice"]').click();

  await expect(page.locator('#peopleList')).not.toContainText('Alice');
  await expect.poll(async () => {
    return page.evaluate(() => window.__gananApp.people);
  }).toEqual(['Bob']);
  await expect.poll(async () => {
    return page.evaluate(() => window.__gananApp.expenses[0]);
  }).toMatchObject({ payer: 'Bob', for: ['Bob'] });
});

test('renaming to existing name does not merge when confirmation is cancelled', async ({ page }) => {
  await openPage(page, 'people');
  await addPerson(page, 'Alice');
  await addPerson(page, 'Bob');

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('Bob');
      return;
    }
    if (dialog.type() === 'confirm') {
      await dialog.dismiss();
    }
  });

  await page.locator('[data-action="rename-person"][data-person="Alice"]').click();

  await expect(page.locator('#peopleList')).toContainText('Alice');
  await expect(page.locator('#peopleList')).toContainText('Bob');
  await expect.poll(async () => {
    return page.evaluate(() => window.__gananApp.people);
  }).toEqual(['Alice', 'Bob']);
});
