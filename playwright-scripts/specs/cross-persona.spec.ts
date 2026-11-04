import { test, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PERSONA_MAP } from '../lib/personas';
import { Watch, attachWatchers, seedAuth, humanPause, perfShim } from '../lib/harness';
import { RESULTS_DIR } from '../lib/env';

/**
 * Cross-persona workflow (XP) — one story, five actors:
 *   1. Farmer posts a produce lot
 *   2. Direct buyer posts a bulk requirement
 *   3. Vyapari sees the trade network lots
 *   4. Transporter sees the loads board
 *   5. E-market customer browses the mall, opens a product, adds to cart
 * No payment/destructive action is taken; the chain stops at escrow boundary.
 */

const observations: Array<{ step: string; actor: string; ok: boolean; detail: string }> = [];
const shotDir = path.join(RESULTS_DIR, 'cross-persona', 'screenshots');

/** 1×1 transparent PNG — stands in for a produce photo so required uploads pass. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

type CreateOutcome = 'created' | 'validation-shown' | 'no-dialog' | 'submit-failed' | 'blocked-by-kyc';

function note(step: string, actor: string, ok: boolean, detail: string) {
  observations.push({ step, actor, ok, detail });
}

/** Fill every visible field of the open form/dialog with sensible dummy data. */
async function fillVisibleForm(page: Page): Promise<number> {
  let filled = 0;
  const textInputs = page.locator(
    'form input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), [role="dialog"] input:not([type=hidden]):not([type=checkbox]):not([type=radio])',
  );
  const n = Math.min(await textInputs.count().catch(() => 0), 12);
  for (let i = 0; i < n; i++) {
    const input = textInputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;
    const type = await input.getAttribute('type').catch(() => 'text');
    const placeholder = ((await input.getAttribute('placeholder').catch(() => '')) || '').toLowerCase();
    let value = 'PW Test';
    if (type === 'tel') value = '9876543210';
    else if (type === 'number') value = /price|rate|amount/i.test(placeholder) ? '101' : '25';
    else if (type === 'date') value = new Date().toISOString().slice(0, 10);
    else if (/crop|produce|name|title|variety/i.test(placeholder)) value = 'PW Test Crop';
    else if (/qty|quantity|acre|area/i.test(placeholder)) value = '25';
    await input.fill('').catch(() => undefined);
    await input.fill(value).catch(() => undefined);
    filled++;
  }
  const selects = page.locator('select, [role="combobox"]');
  const sn = Math.min(await selects.count().catch(() => 0), 6);
  for (let i = 0; i < sn; i++) {
    const sel = selects.nth(i);
    if (!(await sel.isVisible().catch(() => false))) continue;
    if ((await sel.count()) === 0) continue;
    const tag = await sel.evaluate((el) => el.tagName).catch(() => '');
    if (tag === 'SELECT') {
      const options = sel.locator('option');
      const oc = await options.count().catch(() => 0);
      for (let o = 1; o < oc; o++) {
        const val = await options.nth(o).getAttribute('value');
        if (val) {
          await sel.selectOption(val).catch(() => undefined);
          filled++;
          break;
        }
      }
    }
  }
  const combos = page.locator('[role="combobox"]');
  const cn = Math.min(await combos.count().catch(() => 0), 6);
  for (let i = 0; i < cn; i++) {
    const combo = combos.nth(i);
    if (!(await combo.isVisible().catch(() => false))) continue;
    await combo.click({ delay: 80 }).catch(() => undefined);
    await humanPause(400);
    const opt = page.locator('[role="option"], [role="listbox"] > *').first();
    if (await opt.isVisible().catch(() => false)) {
      await opt.click({ delay: 80 }).catch(() => undefined);
      filled++;
      await humanPause(250);
    } else {
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
  const fileInputs = page.locator('input[type="file"]');
  const fn = Math.min(await fileInputs.count().catch(() => 0), 2);
  for (let i = 0; i < fn; i++) {
    await fileInputs
      .nth(i)
      .setInputFiles({ name: 'pw-test-produce.png', mimeType: 'image/png', buffer: PNG_1PX })
      .catch(() => undefined);
    filled++;
  }
  return filled;
}

async function tryCreate(page: Page): Promise<CreateOutcome> {
  // Some create pages are inline forms (e.g. /directBuyer/requirements/new) —
  // no CTA to open a dialog. If inputs are already visible, fill them directly.
  const inlineInputs = page.locator('main input:not([type=hidden]), form input:not([type=hidden])');
  if ((await inlineInputs.count().catch(() => 0)) > 0) {
    const filled = await fillVisibleForm(page);
    if (filled > 0) {
      const submit = page.locator('button:visible').filter({ hasText: /publish|submit|save|create|post/i }).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click({ delay: 90 }).catch(() => undefined);
        await humanPause(1_600);
        const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        if (/identity verification|kyc required|verify your kyc/i.test(text)) return 'blocked-by-kyc';
        if (/required|invalid|please|कृपया|भर/i.test(text)) return 'validation-shown';
        return 'created';
      }
    }
    return 'no-dialog';
  }
  const buttons = page.locator('button:visible').filter({ hasText: /add|new|create|post|publish|save/i });
  const count = Math.min(await buttons.count().catch(() => 0), 4);
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const label = ((await btn.innerText().catch(() => '')) || '').trim();
    if (/pay|buy now|place order|delete|remove|book now|bid/i.test(label)) continue;
    await btn.click({ delay: 80 }).catch(() => undefined);
    await humanPause(900);
    const dialog = page.locator('[role="dialog"], form, [class*="modal"]');
    if (await dialog.first().isVisible().catch(() => false)) {
      const filled = await fillVisibleForm(page);
      if (filled === 0) return 'no-dialog';
      const submit = dialog.first().locator('button:visible').filter({ hasText: /submit|save|create|post|publish|add /i }).first();
      if (!(await submit.isVisible().catch(() => false))) return 'no-dialog';
      await submit.click({ delay: 90 }).catch(() => undefined);
      await humanPause(1_400);
      const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      if (/identity verification|kyc required|verify your kyc/i.test(body)) return 'blocked-by-kyc';
      const stillOpen = await dialog.first().isVisible().catch(() => false);
      if (!stillOpen) return 'created';
      const text = body.slice(0, 4000);
      if (/required|invalid|please|कृपया|भर/i.test(text)) return 'validation-shown';
      return 'submit-failed';
    }
  }
  return 'no-dialog';
}

async function loginAs(context: BrowserContext, personaId: string): Promise<{ page: Page; watch: Watch }> {
  await perfShim(context);
  const persona = PERSONA_MAP.get(personaId)!;
  await seedAuth(context, persona);
  const page = await context.newPage();
  const watch = new Watch();
  attachWatchers(page, watch);
  return { page, watch };
}

test('cross-persona — farmer→buyer→vyapari→transporter→customer chain', async ({ browser }) => {
  fs.mkdirSync(shotDir, { recursive: true });
  test.setTimeout(420_000);

  // 1. Farmer posts a produce lot -------------------------------------------
  {
    const ctx = await browser.newContext();
    const { page, watch } = await loginAs(ctx, 'farmer');
    await page.goto('/farmer/lots');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await humanPause(700);
    const outcome = await tryCreate(page);
    await page.screenshot({ path: path.join(shotDir, 'xp-1-farmer-lot.png') });
    const { pageErrors } = watch.snapshot();
    note('farmer posts produce lot', 'farmer',
      (outcome === 'created' || outcome === 'blocked-by-kyc') && pageErrors.length === 0,
      `create attempt → ${outcome}${pageErrors[0] ? `; pageerror: ${pageErrors[0].slice(0, 120)}` : ''}`);
    await ctx.close();
  }

  // 2. Direct buyer posts a bulk requirement ---------------------------------
  {
    const ctx = await browser.newContext();
    const { page, watch } = await loginAs(ctx, 'directBuyer');
    await page.goto('/directBuyer/requirements/new');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await humanPause(700);
    const outcome = await tryCreate(page);
    await page.screenshot({ path: path.join(shotDir, 'xp-2-buyer-requirement.png') });
    const { pageErrors } = watch.snapshot();
    note('direct buyer posts requirement', 'directBuyer',
      (outcome === 'created' || outcome === 'blocked-by-kyc') && pageErrors.length === 0,
      `create attempt → ${outcome}${pageErrors[0] ? `; pageerror: ${pageErrors[0].slice(0, 120)}` : ''}`);
    await ctx.close();
  }

  // 3. Vyapari sees the lots trade network ------------------------------------
  {
    const ctx = await browser.newContext();
    const { page, watch } = await loginAs(ctx, 'seller');
    await page.goto('/seller/lots');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await humanPause(800);
    const body = await page.evaluate(() => document.body?.innerText ?? '');
    const looksListed = body.length > 100;
    await page.screenshot({ path: path.join(shotDir, 'xp-3-vyapari-lots.png') });
    const { pageErrors } = watch.snapshot();
    note('vyapari views lot discovery', 'seller', looksListed && pageErrors.length === 0,
      `listing renders (${body.length} chars of content)${pageErrors[0] ? `; pageerror: ${pageErrors[0].slice(0, 120)}` : ''}`);
    await ctx.close();
  }

  // 4. Transporter loads board -------------------------------------------------
  {
    const ctx = await browser.newContext();
    const { page, watch } = await loginAs(ctx, 'transporter');
    await page.goto('/transporter/loads');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await humanPause(800);
    const body = await page.evaluate(() => document.body?.innerText ?? '');
    const looksListed = body.length > 100;
    await page.screenshot({ path: path.join(shotDir, 'xp-4-transporter-loads.png') });
    const { pageErrors } = watch.snapshot();
    note('transporter views loads board', 'transporter', looksListed && pageErrors.length === 0,
      `loads board renders (${body.length} chars of content)${pageErrors[0] ? `; pageerror: ${pageErrors[0].slice(0, 120)}` : ''}`);
    await ctx.close();
  }

  // 5. Customer browses mall, opens product, adds to cart ----------------------
  {
    const ctx = await browser.newContext();
    const { page, watch } = await loginAs(ctx, 'customer');
    await page.goto('/mall');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await humanPause(800);
    const firstCard = page.locator('a[href^="/mall/product/"], [class*="product"]').first();
    const clickable = await firstCard.isVisible().catch(() => false);
    let detail = 'no product card found';
    if (clickable) {
      await firstCard.click({ delay: 90 }).catch(() => undefined);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await humanPause(700);
      const addBtn = page.locator('button:visible').filter({ hasText: /add to cart|cart/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click({ delay: 90 }).catch(() => undefined);
        await humanPause(800);
        detail = 'opened product and clicked add-to-cart';
      } else {
        detail = 'product opened, no add-to-cart button visible';
      }
      await page.goto('/mall/cart');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const cart = await page.evaluate(() => document.body?.innerText ?? '');
      detail += `; cart page shows ${cart.length} chars`;
    }
    await page.screenshot({ path: path.join(shotDir, 'xp-5-customer-cart.png') });
    const { pageErrors } = watch.snapshot();
    note('customer browses mall → cart', 'customer', clickable && pageErrors.length === 0, `${detail}${pageErrors[0] ? `; pageerror: ${pageErrors[0].slice(0, 120)}` : ''}`);
    await ctx.close();
  }

  fs.mkdirSync(path.join(RESULTS_DIR, 'cross-persona'), { recursive: true });
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'cross-persona', 'report.json'),
    JSON.stringify({ startedAt: new Date().toISOString(), observations }, null, 2),
  );

  const failed = observations.filter((o) => !o.ok);
  if (failed.length) {
    throw new Error(
      `Cross-persona chain: ${observations.length - failed.length}/${observations.length} steps OK.\n` +
        observations.map((o) => `  ${o.ok ? '✓' : '✗'} [${o.actor}] ${o.step} — ${o.detail}`).join('\n'),
    );
  }
});
