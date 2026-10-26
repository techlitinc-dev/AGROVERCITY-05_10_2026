/**
 * Module 4 — Mandi Prices & Alerts (manual_test/01_farmer.md lines 531-646)
 *
 * TC-FRM-30 … TC-FRM-37 against /farmer/mandi (MandiPricesView).
 *
 * Environment notes discovered while automating:
 *  - The price table filters on `p.mandi`/`p.district` (MandiPrice type) but the
 *    backend serves `mandiName` docs → searching "Nashik" or toggling "My
 *    Markets" crashes the whole React tree. Assertions kept → defects.
 *  - The alert modal POSTs { commodity } while POST /price-alerts requires
 *    `crop` → UI alert creation 422s. Assertion kept → defect.
 *  - "Sell Lot" (title "List lot at this price") is a bare link to /farmer/lots
 *    with no prefill mechanism → assertion kept → defect.
 *  - Compare/history expose no free quantity/months inputs in the UI (presets
 *    only), so TC-FRM-32 validation and TC-FRM-33 month-clamp are asserted at
 *    API level; the UI parts still assert chart/forecast rendering.
 *  - The farmer web app has no Smart-Select UI (only the seller cockpit calls
 *    POST /mandi/smart-select), so TC-FRM-34 is API-level.
 *
 * Setup seeds two pieces of missing UAT data (idempotent, additive):
 * a second Onion price row (Nashik Dindori) and ~40 days of Onion price
 * history for both Nashik mandis, then runs the backend nightly forecast job
 * (the manual's "nightly run" precondition).
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { test, expect } from '../fixtures/auth';
import { api } from '../fixtures/api';

const ONION = 'Onion (प्याज)';
const WHEAT = 'Wheat (गेहूं)';
const TARGET_MANDI = 'Nashik (Dindori Road) APMC';

const BACKEND_DIR = path.resolve(process.cwd(), '../backend');
const PY = path.join(BACKEND_DIR, '.venv/bin/python');

const SEED_PY = `
import asyncio
from datetime import date, timedelta
from app.core.db import set_doc, query
from app.services.mandi_forecast import run_nightly_forecast

ONION = "Onion (प्याज)"

async def main():
    prices = await query("mandi_prices", [], limit=1000)
    if not any(d.get("id") == "mandi-uat-onion-dindori" for d in prices):
        await set_doc("mandi_prices", "mandi-uat-onion-dindori", {
            "id": "mandi-uat-onion-dindori",
            "mandiName": "Nashik (Dindori Road) APMC",
            "commodity": ONION,
            "variety": "Garwa Red",
            "minPrice": 1900, "modalPrice": 2080, "maxPrice": 2300,
            "msp": 1750, "arrivalsQuintals": 9500,
            "distanceKm": 18.5, "trend": "up", "changePercent": "+1.4%",
            "updatedAt": "20 mins ago",
        })
    hist = await query("mandi_price_history", [], limit=10000)
    existing = {d.get("id") for d in hist}
    base = date.today()
    for tag, mandi, offset in (("pimpalgaon", "Pimpalgaon Baswant APMC", 0),
                               ("lasalgaon", "Lasalgaon APMC", 40)):
        for i in range(40):
            d = base - timedelta(days=39 - i)
            doc_id = f"hist-uat-onion-{tag}-{d.isoformat()}"
            if doc_id in existing:
                continue
            await set_doc("mandi_price_history", doc_id, {
                "id": doc_id, "commodity": ONION, "mandiName": mandi,
                "date": d.isoformat(), "modalPrice": 1750 + i * 9 + offset,
            })
    n = await run_nightly_forecast()
    print("mandi seed ok; forecast pairs cached:", n)

asyncio.run(main())
`;

const rupees = (m: RegExpMatchArray | null, label: string): number => {
  expect(m, `rendered value for ${label}`).toBeTruthy();
  return Number((m as RegExpMatchArray)[1].replace(/,/g, ''));
};

test.describe('Module 4 — Mandi Prices & Alerts', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    try {
      execSync(`${JSON.stringify(PY)} -c ${JSON.stringify(SEED_PY)}`, {
        cwd: BACKEND_DIR,
        timeout: 170_000,
        stdio: 'pipe',
      });
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(
        `mandi seed failed: ${err.stdout?.toString() ?? ''}\n${err.stderr?.toString() ?? ''}`
      );
    }
  });

  test('TC-FRM-30: browse mandi prices, search Onion/Nashik, trader rates, mandi list', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/farmer/mandi');

    // Step 1 — price list loads: commodity, mandi, min/modal/max, MSP, trend.
    await expect(
      page.getByRole('heading', { name: /live mandi prices & price discovery/i })
    ).toBeVisible();
    for (const header of [
      /commodity & variety/i,
      /mandi yard/i,
      /min \/ max rate/i,
      /modal price/i,
      /govt msp/i,
      /today's trend/i,
    ]) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator('tbody').getByText(/per quintal/).first()).toBeVisible();

    // Step 2 — search "Onion" filters the list to onion rows.
    await page.getByPlaceholder(/search commodity/i).fill('Onion');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('tbody')).toContainText(ONION);
    await expect(page.locator('tbody')).not.toContainText('Hybrid Red');
    await page.getByPlaceholder(/search commodity/i).fill('');

    // Step 4 — trader (vyapari) rates: on web they surface through the farmer
    // home "Nearby Mandi Live Rates" section (dashboard.home → vyapari rows).
    await page.goto('/farmer');
    await expect(page.getByRole('heading', { name: /nearby mandi live rates/i })).toBeVisible();
    const vyapari = await api.get('/mandi/vyapari-rates', farmerApi.accessToken);
    expect(vyapari.status).toBe(200);
    const vyRows: Array<{ crop: string; rateDisplay: string; lastUpdated: string }> =
      vyapari.body?.data ?? [];
    expect(vyRows.length).toBeGreaterThan(0);
    for (const r of vyRows) {
      expect(r.crop).toBeTruthy();
      expect(r.rateDisplay).toMatch(/₹/);
      expect(r.lastUpdated).toBeTruthy();
    }
    // cached, ≤ 2 h old label (TTL 7200 s)
    expect(Date.now() - Date.parse(vyapari.body.cachedAt)).toBeLessThan(2 * 60 * 60 * 1000);

    // Step 5 — registered mandis with name, district, state (UI pick list + API).
    const list = await api.get('/mandi/list', farmerApi.accessToken);
    expect(list.status).toBe(200);
    const mandis: Array<{ name: string; district: string; state: string }> =
      list.body?.data ?? [];
    expect(mandis.length).toBeGreaterThanOrEqual(4);
    for (const m of mandis) {
      expect(m.name).toBeTruthy();
      expect(m.district).toBeTruthy();
      expect(m.state).toBeTruthy();
    }
    await page.goto('/farmer/mandi');
    const pickOptions = await page
      .getByRole('combobox')
      .first()
      .locator('option')
      .allInnerTexts();
    for (const m of mandis) {
      expect(
        pickOptions.some((o) => o.includes(m.name) && o.includes(m.district)),
        `mandi list option for ${m.name}`
      ).toBe(true);
    }

    // Step 3 — search "Nashik" must show Nashik mandi rows (manual expectation).
    // DEFECT: backend price docs lack the `mandi`/`district` fields this view
    // filters on, so the whole page crashes instead of filtering.
    await page.getByPlaceholder(/search commodity/i).fill('Nashik');
    await expect
      .poll(async () => pageErrors.length, { timeout: 5_000 })
      .toBe(0);
    await expect(rows.first(), 'Nashik search should keep mandi rows rendered').toBeVisible();
  });

  test('TC-FRM-31: mandi compare — transport ₹12/km, net profit sorted desc, hand-verified', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    const token = farmerApi.accessToken;

    // Ground truth at the manual's quantity (20 q): transport = ₹12/km ×
    // distance, net = modal × 20 − transport, rows sorted by net desc.
    const cmp = await api.get('/mandi/compare?crop=Onion&quantityQuintals=20', token);
    expect(cmp.status).toBe(200);
    const cmpRows: Array<{
      mandiName: string;
      modalPrice: number;
      transportCost: number;
      netProfit: number;
    }> = cmp.body.data;
    expect(cmpRows.length).toBeGreaterThanOrEqual(2);
    const prices = (await api.get('/mandi/prices?crop=Onion', token)).body.data as Array<{
      mandiName: string;
      distanceKm: number;
    }>;
    const dist = new Map(prices.map((p) => [p.mandiName, p.distanceKm]));
    for (const r of cmpRows) {
      const d = dist.get(r.mandiName);
      expect(d, `distanceKm for ${r.mandiName}`).toBeDefined();
      expect(r.transportCost, `₹12/km transport for ${r.mandiName}`).toBeCloseTo(d! * 12, 6);
      expect(r.netProfit).toBe(Math.round(r.modalPrice * 20 - r.transportCost));
    }
    const apiNets = cmpRows.map((r) => r.netProfit);
    expect(apiNets).toEqual([...apiNets].sort((a, b) => b - a));

    // UI — arbitrage engine: verify the math by hand from rendered values.
    await page.goto('/farmer/mandi');
    await page.getByRole('combobox').nth(1).selectOption(ONION); // chart commodity
    await expect(page.getByText('★ Max Profit')).toBeVisible();

    const cards = page.locator('div.rounded-2xl.border').filter({ hasText: 'Mandi Rate:' });
    await expect(cards.first()).toBeVisible();

    const verifyCards = async (qty: number) => {
      for (const r of cmpRows) {
        const card = cards.filter({ hasText: r.mandiName });
        await expect(card).toContainText(`Gross Value (${qty} Qtl)`);
        const t = await card.innerText();
        const rate = rupees(t.match(/Mandi Rate:\s*₹([\d,]+)/s), 'modal rate');
        const gross = rupees(t.match(/Gross Value \(\d+ Qtl\):\s*₹([\d,]+)/s), 'gross value');
        const transport = rupees(t.match(/Transport & Haulage:\s*-\s*₹([\d,]+)/s), 'transport');
        const net = rupees(t.match(/निव्वळ नफा:\s*₹([\d,]+)/s), 'net profit');
        // rendered values match the API ground truth (rate & transport are qty-independent)
        expect(rate).toBe(r.modalPrice);
        expect(transport).toBeCloseTo(r.transportCost, 6);
        // hand calculation: gross = modal × qty; net = gross − transport
        expect(gross).toBe(rate * qty);
        expect(net).toBe(gross - transport);
        // ₹12/km transport on the rendered row too
        expect(transport).toBeCloseTo((dist.get(r.mandiName) ?? 0) * 12, 6);
      }
      // rows are sorted by net profit descending; top card is the best mandi
      const renderedNets: number[] = [];
      for (let i = 0; i < (await cards.count()); i++) {
        const t = await cards.nth(i).innerText();
        renderedNets.push(rupees(t.match(/निव्वळ नफा:\s*₹([\d,]+)/s), 'net profit'));
      }
      expect(renderedNets).toEqual([...renderedNets].sort((a, b) => b - a));
      await expect(cards.first()).toContainText(cmpRows[0].mandiName);
      await expect(cards.first()).toContainText('★ Max Profit');
    };

    await verifyCards(30); // default lot size selected in the UI

    // switch the lot-size preset and re-verify the recomputed cards
    await page.getByRole('button', { name: '15 Qtl' }).click();
    await verifyCards(15);
  });

  test('TC-FRM-32: mandi compare validation — quantity 0 / −5 / blank crop rejected', async ({
    farmerApi,
  }) => {
    const t = farmerApi.accessToken;
    // The web compare UI only offers fixed positive presets, so the validation
    // surface is the API the UI calls; errors must be 422 with no results.
    const q0 = await api.get('/mandi/compare?crop=Onion&quantityQuintals=0', t);
    expect(q0.status).toBe(422);
    expect(q0.body.error.code).toBe('INVALID_QUANTITY');
    expect(q0.body.data).toBeUndefined();

    const qNeg = await api.get('/mandi/compare?crop=Onion&quantityQuintals=-5', t);
    expect(qNeg.status).toBe(422);
    expect(qNeg.body.error.code).toBe('INVALID_QUANTITY');
    expect(qNeg.body.data).toBeUndefined();

    const noCrop = await api.get('/mandi/compare?quantityQuintals=20', t);
    expect(noCrop.status).toBe(422);
    expect(noCrop.body.error.code).toBe('VALIDATION_ERROR');
    expect(noCrop.body.error.fieldErrors.crop).toBeTruthy();
    expect(noCrop.body.data).toBeUndefined();
  });

  test('TC-FRM-33: price history chart, months clamp 1–36, 7-day forecast, graceful 404', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    const t = farmerApi.accessToken;

    // Step 2 — months 1..36 accepted; out-of-range clamped (API level: the web
    // UI exposes no months input).
    const pts = async (m: number) =>
      ((await api.get(`/mandi/prices/history?crop=Onion&months=${m}`, t)).body?.data ?? [])
        .length;
    expect(await pts(0)).toBe(await pts(1)); // 0 clamps to 1
    expect(await pts(40)).toBe(await pts(36)); // 40 clamps to 36
    expect(await pts(36)).toBeGreaterThan(await pts(1));

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto('/farmer/mandi');

    // Steps 1+3 — chart + 7-day forecast load for Onion (default mandi =
    // first mandi in the farmer's district, per the backend default).
    await page.getByRole('combobox').nth(1).selectOption(ONION);
    await expect(page.locator('svg.recharts-surface')).toBeVisible();
    await expect(page.getByText(`7-Day Price Forecast — ${ONION}`)).toBeVisible();

    // Step 4 — crop+mandi with no nightly forecast run: 404 handled, no crash.
    const nf = await api.get(
      `/mandi/forecast?crop=${encodeURIComponent(WHEAT)}&mandi=${encodeURIComponent(
        'Vashi (Navi Mumbai) Terminal'
      )}`,
      t
    );
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('FORECAST_NOT_FOUND');

    await page.getByRole('combobox').nth(2).selectOption({ label: /Vashi/ });
    await page.getByRole('combobox').nth(1).selectOption(WHEAT);
    await expect(page.getByText(`No history available for ${WHEAT} yet.`)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible(); // price table survives
    expect(pageErrors).toEqual([]);
  });

  test('TC-FRM-34: AI smart-select — ranking, source label, hand-verified paisa math', async ({
    farmerApi,
  }) => {
    const t = farmerApi.accessToken;
    // The farmer web app has no Smart-Select UI (seller cockpit only), so the
    // TC is exercised against the API the feature is built on.
    const res = await api.post(
      '/mandi/smart-select',
      { crop: 'Onion', quantityQuintals: 20, district: 'Nashik' },
      t
    );
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(['ai', 'fallback']).toContain(d.source);
    expect(d.automationLevel).toBe('suggest');
    expect(d.district).toBe('Nashik');
    expect(d.candidates.length).toBeGreaterThanOrEqual(2);

    // paisa math on every candidate: net = modal×qty − transport − commission
    for (const c of d.candidates) {
      expect(c.netPaisa).toBe(
        c.modalPricePaisa * d.quantityQuintals - c.transportFarePaisa - c.commissionPaisa
      );
    }
    // top candidate matches rank 1; ranking sorted by net desc
    expect(d.best.rank).toBe(1);
    expect(d.best.mandi).toBe(d.candidates[0].mandi);
    const nets = d.candidates.map((c: { netPaisa: number }) => c.netPaisa);
    expect(nets).toEqual([...nets].sort((a: number, b: number) => b - a));

    // Step 4 — quantity 0 rejected (422); blank crop rejected; unknown crop has
    // no mandi data (NO_MANDI_DATA).
    const q0 = await api.post('/mandi/smart-select', { crop: 'Onion', quantityQuintals: 0 }, t);
    expect(q0.status).toBe(422);
    const blank = await api.post('/mandi/smart-select', { crop: '   ', quantityQuintals: 20 }, t);
    expect(blank.status).toBe(422);
    expect(blank.body.error.code).toBe('VALIDATION_ERROR');
    const noData = await api.post('/mandi/smart-select', { crop: 'Quinoa', quantityQuintals: 20 }, t);
    expect(noData.status).toBe(422);
    expect(noData.body.error.code).toBe('NO_MANDI_DATA');
  });

  test('TC-FRM-35: saved markets — pin a mandi, "My Markets" filter, remove', async ({
    farmerPage: page,
  }) => {
    const pinTitle = `Remove ${TARGET_MANDI} from saved markets`;
    await page.goto('/farmer/mandi');

    // idempotent setup: drop a leftover pin from an interrupted previous run
    const leftover = page.locator(`button[title="${pinTitle}"]`);
    if ((await leftover.count()) > 0) {
      await leftover.first().click();
      await expect(page.getByText(/No saved markets yet/)).toBeVisible();
    }

    // Step 1 — pin Nashik (Dindori Road) APMC: appears under saved markets.
    await page
      .getByRole('combobox')
      .first()
      .selectOption({ label: `${TARGET_MANDI} — Nashik` });
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Saved Markets (1)')).toBeVisible();
    await expect(page.getByText(`${TARGET_MANDI} pinned to your saved markets.`)).toBeVisible();
    await expect(page.getByText(TARGET_MANDI).first()).toBeVisible();

    // Step 2 — "Show only rates from your saved markets" filters the price list.
    // DEFECT: the filter reads p.mandi (undefined on backend docs) and crashes
    // the whole page instead of filtering.
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    try {
      await page.getByRole('button', { name: /my markets/i }).click();
      await expect
        .poll(async () => pageErrors.length, { timeout: 5_000 })
        .toBe(0);
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      await expect(page.locator('tbody')).toContainText(TARGET_MANDI);
    } finally {
      // Step 3 — remove the pin; saved list empties and the full list is back.
      await page.goto('/farmer/mandi');
      await page.locator(`button[title="${pinTitle}"]`).first().click();
      await expect(page.getByText('Saved Markets (0)')).toBeVisible();
      await expect(page.getByText(/No saved markets yet/)).toBeVisible();
      await expect(page.locator('tbody tr').first()).toBeVisible();
    }
  });

  test('TC-FRM-36: create mandi price alert — Onion above ₹1,500, listed + bell notification', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    await page.goto('/farmer/mandi');

    // Step 1 — Create Mandi Price Alert modal: crop + target price fields.
    await page.getByRole('button', { name: /set price alert/i }).click();
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal.getByText('Create Mandi Price Alert')).toBeVisible();

    // Step 2 — fill the test data and save; alert must be saved and listed.
    // DEFECT: the modal POSTs { commodity } but POST /price-alerts requires
    // `crop`, so saving fails with 422 "crop: Field required".
    await modal.locator('select').selectOption(ONION);
    await modal.locator('input[type="number"]').fill('1500');
    await modal.getByRole('button', { name: /save & activate/i }).click();

    await expect(
      page.getByText(new RegExp(`Price alert active for .* at ₹1,500/q`))
    ).toBeVisible();
    await expect(page.getByText(/My Active Price Alerts \(\d+\)/)).toBeVisible();
    await expect(page.getByText('Target ₹1,500/q').first()).toBeVisible();

    const alerts = (await api.get('/price-alerts', farmerApi.accessToken)).body.data as Array<{
      crop: string;
      targetPrice: number;
    }>;
    expect(alerts.some((a) => a.crop === ONION && a.targetPrice === 1500)).toBe(true);

    // Steps 3+4 — Nashik onion modal (₹2,100 avg) is already above ₹1,500, so
    // the alert fires on the next list; the bell must show the notification.
    await page.reload();
    await page.locator('button[title="Notifications"]').click();
    const panel = page.locator('div.fixed.inset-0.z-50');
    await expect(panel.getByText('Price alert / भाव अलर्ट').first()).toBeVisible();
    await expect(panel.getByText(`mandi modal ₹2,100 ≥ your ₹1,500`).first()).toBeVisible();

    const notifs = (await api.get('/notifications?pageSize=50', farmerApi.accessToken)).body
      .data as Array<{ type: string; body: string }>;
    expect(
      notifs.some((n) => n.type === 'price_alert' && n.body.includes(ONION) && /₹1500/.test(n.body))
    ).toBe(true);
  });

  test('TC-FRM-37: delete the alert + "List lot at this price" opens prefilled Post Lot', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    // Setup (TC-FRM-36's UI creation is broken — see that TC): ensure the
    // alert exists via the API so the farmer-side UI steps can be exercised.
    const existing = (await api.get('/price-alerts', farmerApi.accessToken)).body.data as Array<{
      id: string;
      crop: string;
      targetPrice: number;
    }>;
    if (!existing.some((a) => a.crop === ONION && a.targetPrice === 1500)) {
      const created = await api.post(
        '/price-alerts',
        { crop: ONION, targetPrice: 1500, above: true },
        farmerApi.accessToken
      );
      expect(created.status).toBe(201);
    }

    await page.goto('/farmer/mandi');
    const card = page
      .locator('div.rounded-2xl.border')
      .filter({ hasText: 'Target ₹1,500/q' })
      .first();
    await expect(card).toBeVisible();

    // Step 1 — delete the alert: it disappears from the list and the API.
    await card.locator('button[title="Delete alert"]').click();
    await expect(page.getByText('Target ₹1,500/q')).toHaveCount(0);
    const after = (await api.get('/price-alerts', farmerApi.accessToken)).body.data as Array<{
      crop: string;
      targetPrice: number;
    }>;
    expect(after.some((a) => a.crop === ONION && a.targetPrice === 1500)).toBe(false);

    // Step 2 — "List lot at this price" on a mandi row must open the Post Lot
    // form prefilled with the crop and that mandi's modal price.
    // DEFECT: the link is a bare /farmer/lots navigation with no prefill.
    await page.getByRole('combobox').nth(1).selectOption(ONION); // compare cards for Onion
    await expect(page.getByText('★ Max Profit')).toBeVisible();
    const topModal = (
      (await api.get('/mandi/compare?crop=Onion&quantityQuintals=20', farmerApi.accessToken))
        .body.data as Array<{ mandiName: string; modalPrice: number }>
    )[0];

    await page.locator('a[title="List lot at this price"]').first().click();
    await expect(page).toHaveURL(/\/farmer\/lots/);
    await expect(page.getByText('Post New Produce Lot')).toBeVisible();
    await expect(page.getByRole('combobox').first()).toHaveValue('Onion');
    await expect(
      page.locator('input[type="number"]').nth(1) // Expected Price (₹/q)
    ).toHaveValue(String(topModal.modalPrice));
  });
});
