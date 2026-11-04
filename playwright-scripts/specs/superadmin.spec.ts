import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR, SUPERADMIN_URL } from '../lib/env';
import { Watch, attachWatchers, humanPause, perfShim } from '../lib/harness';

test.beforeEach(async ({ context }) => {
  await perfShim(context);
});

/**
 * Superadmin master console (port 5174). The app auto-logins as the seeded
 * Super Admin Root (+919000000001 / 1234) on first load; here a human tester
 * clicks through every governance panel in the sidebar.
 */

const PANELS = [
  'Overview & Analytics',
  'Farmer Pages & CMS',
  '1. Farmer Governance',
  '2. Farm Landlord Desk',
  '3. Transport & Logistics',
  '4. Vyapari Trader Desk',
  '5. Machinery & Yantra',
  'Export & Trade Desk',
  'Livestock Hub',
  'FPO & Cooperatives',
  'Mahila Graha Udyog',
  'Gurukul Academy',
  'Banking & Insurance',
  'Cold Storage Hub',
  'Nursery & Agroforestry',
  'eMarket Customer Mall',
  'Multi-User & RBAC Desk',
];

test(`superadmin — walks all ${PANELS.length} governance panels`, async ({ page }) => {
  const watch = new Watch();
  attachWatchers(page, watch);
  const shotDir = path.join(RESULTS_DIR, 'superadmin', 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });

  const results: Array<{ panel: string; status: 'pass' | 'fail'; issues: string[] }> = [];

  await page.goto(SUPERADMIN_URL + '/');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await humanPause(800);

  for (let i = 0; i < PANELS.length; i++) {
    watch.reset();
    const panel = PANELS[i];
    const issues: string[] = [];
    try {
      const item = page.getByText(panel, { exact: false }).first();
      await item.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await item.click({ timeout: 8_000 });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await humanPause(700);
      const contentChars = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
      if (contentChars < 40) issues.push(`panel looks blank (${contentChars} chars)`);
    } catch (err) {
      issues.push(`panel not clickable: ${String(err).slice(0, 160)}`);
    }
    const { pageErrors, consoleErrors, badNetwork } = watch.snapshot();
    if (pageErrors.length) issues.push(`pageerror: ${pageErrors[0]}`);
    const hard = consoleErrors.filter((e) => e.type === 'error');
    if (hard.length) issues.push(`console.error: ${hard[0].text.slice(0, 140)}`);
    if (badNetwork.length) issues.push(`HTTP ${badNetwork[0].status ?? 'failed'} on ${badNetwork[0].url.slice(-80)}`);
    await page.screenshot({ path: path.join(shotDir, `${String(i).padStart(2, '0')}-${panel.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => undefined);
    results.push({ panel, status: issues.length ? 'fail' : 'pass', issues });
  }

  fs.mkdirSync(path.join(RESULTS_DIR, 'superadmin'), { recursive: true });
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'superadmin', 'report.json'),
    JSON.stringify({ startedAt: new Date().toISOString(), baseUrl: SUPERADMIN_URL, results }, null, 2),
  );

  const failed = results.filter((r) => r.status === 'fail');
  if (failed.length) {
    throw new Error(
      `Superadmin: ${failed.length}/${PANELS.length} panels failing:\n` +
        failed.map((r) => `  ✗ ${r.panel} — ${r.issues.join(' | ')}`).join('\n'),
    );
  }
});
