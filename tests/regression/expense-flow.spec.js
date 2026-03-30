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

  await openPage(page, 'people');
  await addPerson(page, 'Alice');
  await addPerson(page, 'Bob');
  await addPerson(page, 'Charlie');
});

test('calculates balances and optimized settlements correctly', async ({ page }) => {
  await openPage(page, 'add-expense');

  await addExpense(page, { payer: 'Alice', amount: 300, beneficiaries: ['Alice', 'Bob', 'Charlie'] });
  await addExpense(page, { payer: 'Bob', amount: 600, beneficiaries: ['Alice', 'Bob'] });

  await openPage(page, 'balances');
  await expect(page.locator('#balancesContainer')).toContainText(/Bob[\s\S]*owed[\s\S]*200\.00/);
  await expect(page.locator('#balancesContainer')).toContainText(/Alice[\s\S]*owes[\s\S]*100\.00/);
  await expect(page.locator('#balancesContainer')).toContainText(/Charlie[\s\S]*owes[\s\S]*100\.00/);

  await openPage(page, 'settlements');
  await expect(page.locator('#settlementsContainer')).toContainText('Alice pays Bob');
  await expect(page.locator('#settlementsContainer')).toContainText('Charlie pays Bob');
  await expect(page.locator('#settlementsContainer')).toContainText('100.00');
});

test('updates balances and settlements after deleting an expense', async ({ page }) => {
  await openPage(page, 'add-expense');

  await addExpense(page, { payer: 'Alice', amount: 300, beneficiaries: ['Alice', 'Bob', 'Charlie'] });
  await addExpense(page, { payer: 'Bob', amount: 600, beneficiaries: ['Alice', 'Bob'] });

  page.on('dialog', (dialog) => dialog.accept());
  await openPage(page, 'expenses');
  await page.locator('.btn-delete').first().click();

  await openPage(page, 'balances');
  await expect(page.locator('#balancesContainer')).toContainText(/Bob[\s\S]*owed[\s\S]*300\.00/);
  await expect(page.locator('#balancesContainer')).toContainText(/Alice[\s\S]*owes[\s\S]*300\.00/);

  await openPage(page, 'settlements');
  await expect(page.locator('#settlementsContainer')).toContainText('Alice pays Bob');
  await expect(page.locator('#settlementsContainer')).toContainText('300.00');
});

test('keeps local session data after reload', async ({ page }) => {
  await openPage(page, 'add-expense');
  await addExpense(page, { payer: 'Alice', amount: 90, beneficiaries: ['Alice', 'Bob', 'Charlie'] });

  await openPage(page, 'expenses');
  await expect(page.locator('#expenseListContainer')).toContainText('Alice');
  await expect(page.locator('#expenseListContainer')).toContainText('90.00');
  await expect.poll(async () => {
    return page.evaluate(() => localStorage.getItem('ganan_sessions') || '');
  }).toContain('Alice');

  await page.reload();

  await openPage(page, 'expenses');
  await expect(page.locator('#expenseListContainer')).toContainText('Alice');
  await expect(page.locator('#expenseListContainer')).toContainText('90.00');

  await openPage(page, 'balances');
  await expect(page.locator('#balancesContainer')).toContainText(/Alice[\s\S]*owed[\s\S]*60\.00/);
});
