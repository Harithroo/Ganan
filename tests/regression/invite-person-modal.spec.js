import { expect, test } from '@playwright/test';

async function openInvitePersonModal(page, people = ['Alice', 'Bob'], suggested = 'Charlie') {
  await page.evaluate(
    ({ list, suggestion }) => {
      window.__invitePersonChoicePromise = window.__gananApp.promptForPersonLink(list, suggestion);
    },
    { list: people, suggestion: suggested }
  );

  await expect(page.locator('#invitePersonModal')).toBeVisible();
}

async function readInvitePersonChoice(page) {
  return page.evaluate(async () => {
    return await window.__invitePersonChoicePromise;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
});

test('invite modal lets user choose an existing person', async ({ page }) => {
  await openInvitePersonModal(page, ['Alice', 'Bob'], 'Charlie');

  await page.check('input[name="invitePersonExisting"][value="Bob"]');
  await page.click('#invitePersonConfirmBtn');

  await expect(page.locator('#invitePersonModal')).toBeHidden();
  await expect.poll(() => readInvitePersonChoice(page)).toBe('Bob');
});

test('invite modal supports creating a new person name', async ({ page }) => {
  await openInvitePersonModal(page, ['Alice', 'Bob'], 'Charlie');

  await page.fill('#invitePersonNewNameInput', '  New Person  ');
  await page.click('#invitePersonConfirmBtn');

  await expect(page.locator('#invitePersonModal')).toBeHidden();
  await expect.poll(() => readInvitePersonChoice(page)).toBe('New Person');
});

test('invite modal cancels cleanly with Escape', async ({ page }) => {
  await openInvitePersonModal(page, ['Alice', 'Bob'], 'Charlie');

  await page.keyboard.press('Escape');

  await expect(page.locator('#invitePersonModal')).toBeHidden();
  await expect.poll(() => readInvitePersonChoice(page)).toBe(null);
});
