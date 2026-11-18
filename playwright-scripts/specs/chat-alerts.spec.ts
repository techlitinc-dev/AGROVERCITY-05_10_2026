import { test, expect } from '@playwright/test';
import { Watch, attachWatchers, perfShim, seedAuth } from '../lib/harness';
import { PERSONAS } from '../lib/personas';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

const farmer = PERSONAS.find((p) => p.id === 'farmer')!;

const room = (unread: number) => ({
  id: 'room_alert1',
  farmerId: 'dev-user-1',
  buyerId: 'usr_buyer_test',
  kind: 'purchase',
  counterpartyName: 'Test Buyer',
  lastMessageText: 'Rate final 4800/q, pickup tomorrow?',
  lastMessageAt: '2026-11-18T06:00:00+00:00',
  unreadCount: unread,
});

test('incoming chat message pops an alert on the dashboard and View opens the thread', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  // The unread count flips to 1 only after the component's baseline poll.
  let unread = 0;
  let calls = 0;
  await page.route('**/v1/chat/rooms', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    calls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [room(unread)], total: 1 }),
    });
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/farmer');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // Wait for the baseline poll to establish the unread=0 baseline.
  await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByText('New message from Test Buyer')).toHaveCount(0);

  // New message arrives → next poll fires the popup.
  unread = 1;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('New message from Test Buyer')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Rate final 4800\/q/)).toBeVisible();

  await page.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/chat\?room=room_alert1/, { timeout: 15_000 });

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('chat alert does not fire for the room that is already open', async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);

  let unread = 0;
  let calls = 0;
  await page.route('**/v1/chat/rooms', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    calls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [room(unread)], total: 1 }),
    });
  });

  await seedAuth(page.context(), farmer);
  await page.goto('/chat?room=room_alert1');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

  unread = 1;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // Room is open — no popup even though unread increased.
  await page.waitForTimeout(3000);
  await expect(page.getByText('New message from Test Buyer')).toHaveCount(0);

  const { pageErrors } = watch.snapshot();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
