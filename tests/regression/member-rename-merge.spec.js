import { expect, test } from '@playwright/test';

async function setupMemberRenameScenario(page) {
  await page.evaluate(() => {
    const app = window.__gananApp;

    app.db = {
      collection: () => ({
        doc: () => ({
          set: async () => {}
        })
      })
    };
    app.syncSessionScopedCollections = async () => {};
    app.currentUser = { uid: 'owner', email: 'owner@example.com' };
    app.activeSessionId = 'sess1';
    app.sessions = [
      {
        id: 'sess1',
        ownerId: 'owner',
        memberIds: ['owner', 'u2'],
        memberProfiles: { owner: 'Host', u2: 'Alice' },
        data: {
          people: ['Alice', 'Bob'],
          expenses: [
            {
              id: 'exp1',
              payer: 'Alice',
              amount: 100,
              original: { amount: 100, currency: 'LKR' },
              for: ['Alice', 'Bob'],
              description: 'Test',
              createdAt: Date.now()
            }
          ],
          conversions: [],
          smartSettlement: true,
          collectorPerson: null
        }
      }
    ];
    app.loadActiveSessionData();
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
});

test('renaming a session member to an existing person confirms and merges', async ({ page }) => {
  await setupMemberRenameScenario(page);

  const result = await page.evaluate(async () => {
    const app = window.__gananApp;
    window.prompt = () => 'Bob';
    window.confirm = () => true;
    window.alert = () => {};

    await app.renameSessionMember('u2');

    return {
      people: app.people,
      memberName: app.getActiveSession().memberProfiles.u2,
      payer: app.expenses[0]?.payer,
      beneficiaries: app.expenses[0]?.for || []
    };
  });

  expect(result.people).toEqual(['Bob']);
  expect(result.memberName).toBe('Bob');
  expect(result.payer).toBe('Bob');
  expect(result.beneficiaries).toEqual(['Bob']);
});

test('renaming a session member to existing person keeps data when merge is cancelled', async ({ page }) => {
  await setupMemberRenameScenario(page);

  const result = await page.evaluate(async () => {
    const app = window.__gananApp;
    window.prompt = () => 'Bob';
    window.confirm = () => false;
    window.alert = () => {};

    await app.renameSessionMember('u2');

    return {
      people: app.people,
      memberName: app.getActiveSession().memberProfiles.u2,
      payer: app.expenses[0]?.payer,
      beneficiaries: app.expenses[0]?.for || []
    };
  });

  expect(result.people).toEqual(['Alice', 'Bob']);
  expect(result.memberName).toBe('Alice');
  expect(result.payer).toBe('Alice');
  expect(result.beneficiaries).toEqual(['Alice', 'Bob']);
});
