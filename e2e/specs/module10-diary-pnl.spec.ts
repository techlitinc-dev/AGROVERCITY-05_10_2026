/**
 * Module 10 — Farm Diary & P&L
 * Automates TC-FRM-74 … TC-FRM-82 of manual_test/01_farmer.md (lines 1225-1354).
 *
 * Views under test:
 *   website/src/views/farmer/FarmDiaryView.tsx   (/farmer/diary)
 *   website/src/views/farmer/PnlDashboardView.tsx (/farmer/pnl)
 *
 * Notes on shared data: the backend is shared with parallel suites, so every
 * created entry title is suffixed with a unique token, coin assertions use
 * before/after deltas, and throwaway accounts (freshPhone) are used wherever a
 * second actor is needed.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '../fixtures/auth';
import { api, loginWithMpin } from '../fixtures/api';
import { API_BASE, FARMER, freshPhone } from '../test-data';

const today = () => new Date().toISOString().slice(0, 10);
const uniq = Date.now().toString(36);

// Titles created by this file (tracked across serial tests).
const T = {
  urea: `Urea fertiliser UAT ${uniq}`, // TC-FRM-74, reused by 76/79
  income: `Onion advance from trader UAT ${uniq}`, // TC-FRM-75
  activity: `Drip irrigation installed UAT ${uniq}`, // TC-FRM-75, deleted by 76
  probe: `Validation probe UAT ${uniq}`, // TC-FRM-77
};

// IDs discovered at runtime via API (shared across serial tests).
const state: { ureaId?: string; activityId?: string; purchaseId?: string; lotSaleAmount?: number } = {};

async function coinBalance(token: string): Promise<number> {
  const { status, body } = await api.get('/gamification/status', token);
  if (status !== 200) throw new Error(`gamification/status failed: ${JSON.stringify(body).slice(0, 200)}`);
  return body.agriCoins as number;
}

/** Find one of OUR diary entries by its unique title. */
async function findEntry(token: string, title: string): Promise<any | null> {
  const { body } = await api.get('/diary/entries', token, { q: title, pageSize: '50' });
  return (body?.data ?? []).find((e: any) => e.title === title) ?? null;
}

/** Onboard a throwaway account and return its session token. */
async function throwawayUser(persona: string): Promise<string> {
  const phone = freshPhone().slice(0, 8) + String(Math.floor(Math.random() * 90) + 10);
  const { status, body } = await api.post('/auth/onboard', {
    phone,
    name: `UAT ${persona} ${uniq}`,
    mpin: '4321',
    persona,
    state: FARMER.state,
    district: FARMER.district,
    village: FARMER.village,
  });
  if (status !== 200 || !body?.accessToken) {
    throw new Error(`onboard ${persona} failed (${status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  const session = await loginWithMpin(phone, '4321');
  return session.accessToken;
}

test.describe('Module 10 — Farm Diary & P&L', () => {
  test('TC-FRM-74: Add an expense entry (+15 Kisan Coins)', async ({ farmerPage: page, farmerApi }) => {
    // --- Steps 1-2: Farm Diary → Add Expense, fill test data, save ---
    await page.goto('/farmer/diary');
    await expect(page.getByRole('heading', { name: /farm diary & p&l/i })).toBeVisible();

    await page.getByRole('button', { name: /add diary entry/i }).click();
    const modal = page.locator('form');
    await expect(page.getByRole('heading', { name: 'Add Farm Diary Entry' })).toBeVisible();
    // Form offers title, category, crop, party, amount, date, notes (manual step 1)
    await expect(modal.getByPlaceholder(/urea purchase/i)).toBeVisible(); // title
    await expect(modal.locator('select').first()).toBeVisible(); // entry type
    await expect(modal.locator('input[type=number]')).toBeVisible(); // amount
    await expect(modal.locator('input[type=date]')).toBeVisible(); // date

    // Entry type defaults to expense; category defaults to Fertilizers.
    await modal.locator('select').nth(2).selectOption('Onion'); // crop
    await modal.getByPlaceholder(/urea purchase/i).fill(T.urea);
    await modal.getByPlaceholder(/anil traders/i).fill(FARMER.diaryExpense.party);
    await modal.locator('input[type=number]').fill(String(FARMER.diaryExpense.amount));
    await modal.locator('input[type=date]').fill(today());
    await modal.getByPlaceholder(/purchased 2 bags/i).fill(FARMER.diaryExpense.notes);

    // --- Step 3a: +15 coins credited — balance delta around OUR save ---
    const coinsBefore = await coinBalance(farmerApi.accessToken);
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(page.getByText(/entry saved to farm diary/i)).toBeVisible();
    const coinsAfter = await coinBalance(farmerApi.accessToken);
    expect(coinsAfter - coinsBefore, 'coin balance delta for the diary entry').toBeGreaterThanOrEqual(15);

    // Entry listed under expenses with correct values (manual step 2)
    const row = page.locator('tr', { hasText: T.urea });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Fertilizers');
    await expect(row).toContainText(`Party: ${FARMER.diaryExpense.party}`);
    await expect(row).toContainText('Crop: Onion');
    await expect(row).toContainText(`-${formatINR(FARMER.diaryExpense.amount)}`);
    await expect(row).toContainText(FARMER.diaryExpense.notes);

    // --- Step 3b: ledger line "diary_entry +15" (API + Kisan Coins UI) ---
    const entry = await findEntry(farmerApi.accessToken, T.urea);
    expect(entry, 'expense entry persisted via API').toBeTruthy();
    state.ureaId = entry.id;
    const { body: ledger } = await api.get('/gamification/ledger', farmerApi.accessToken, { pageSize: '20' });
    const line = (ledger?.data ?? []).find((l: any) => l.reason === 'diary_entry' && l.refId === entry.id);
    expect(line, 'ledger line diary_entry +15 for this entry').toBeTruthy();
    expect(line.amount).toBe(15);

    await page.goto('/farmer/coins');
    await expect(page.getByText(/coin ledger/i)).toBeVisible();
    await expect(page.getByText('diary_entry').first()).toBeVisible();
    await expect(page.getByText(/^\+15$/).first()).toBeVisible();
    // Balance card must reflect the credited coins (manual: "+15 coins credited").
    const balCard = page
      .getByText('Current Balance', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(balCard).toContainText('Coins');
    const balText = (await balCard.innerText()).replace(/[^\d]/g, '');
    expect
      .soft(parseInt(balText, 10), `Kisan Coins balance card shows API balance (${coinsAfter})`)
      .toBeGreaterThanOrEqual(coinsAfter);

    // --- Step 4: bell / tasks shows a coins_earned notification ---
    // (Checked via API to avoid the drawer's batch-read side effect on the shared account.)
    const { body: inbox } = await api.get('/notifications', farmerApi.accessToken, { pageSize: '50' });
    const coinsEarned = (inbox?.data ?? []).filter((n: any) => n.type === 'coins_earned');
    expect
      .soft(coinsEarned.length, 'coins_earned task/notification exists for the diary entry')
      .toBeGreaterThan(0);
  });

  test('TC-FRM-75: Add income and farm-activity entries with photos', async ({ farmerPage: page, farmerApi }) => {
    // --- Step 1: income entry ₹5,000 via UI ---
    await page.goto('/farmer/diary');
    await page.getByRole('button', { name: /add diary entry/i }).click();
    const modal = page.locator('form');
    await modal.locator('select').first().selectOption('income');
    await modal.getByPlaceholder(/urea purchase/i).fill(T.income);
    await modal.locator('input[type=number]').fill('5000');
    await modal.locator('input[type=date]').fill(today());
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(page.getByText(/entry saved to farm diary/i)).toBeVisible();
    const incomeRow = page.locator('tr', { hasText: T.income });
    await expect(incomeRow).toBeVisible();
    await expect(incomeRow).toContainText(`+${formatINR(5000)}`);
    const income = await findEntry(farmerApi.accessToken, T.income);
    expect(income?.type).toBe('income');
    expect(income?.amount).toBe(5000);

    // --- Step 2: farm-activity entry, attach 2 photos (jpeg ≤ 5 MB) ---
    await page.getByRole('button', { name: /add diary entry/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Farm Diary Entry' })).toBeVisible();
    await page.locator('form select').first().selectOption('farmActivity');
    await page.getByPlaceholder(/urea purchase/i).fill(T.activity);
    await page.locator('form input[type=number]').fill('0');
    await page.locator('form input[type=date]').fill(today());
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(page.getByText(/entry saved to farm diary/i)).toBeVisible();

    const activity = await findEntry(farmerApi.accessToken, T.activity);
    expect(activity, 'activity entry persisted').toBeTruthy();
    state.activityId = activity.id;

    // Attach photo #1 through the row's camera button → "Choose Photo" file input.
    const activityRow = page.locator('tr', { hasText: T.activity });
    await activityRow.getByTitle('Attach photo').click();
    await expect(page.getByRole('heading', { name: /attach photo to entry/i })).toBeVisible();
    const fileInput = page.locator('input[type=file]');
    await fileInput.setInputFiles('/tmp/uat-diary-photo-1.jpg');
    // The website posts {photoUrls} JSON to /diary/entries/{id}/photos, but the
    // backend requires multipart `files` → the attach fails. Expected (soft):
    // photos get attached and no error appears. Actual: error banner + 0 photos.
    await expect(page.locator('div.bg-rose-50').first()).toBeVisible({ timeout: 15_000 });
    const { body: after1 } = await api.get('/diary/entries', farmerApi.accessToken, { q: T.activity });
    const saved = (after1?.data ?? [])[0];
    expect.soft(saved.photos?.length ?? 0, 'photo #1 attached to the activity entry').toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    // --- Steps 3-4: 3rd photo accepted, 4th blocked (1-3 allowed) ---
    // Cannot proceed via UI while the attach call fails; verify the 1-3 rule on
    // the backend endpoint directly (multipart, as the backend expects).
    const fd = new FormData();
    for (const p of ['1', '2', '3', '4']) {
      fd.append('files', new Blob([readFileSync('/tmp/uat-diary-photo-1.jpg')], { type: 'image/jpeg' }), `p${p}.jpg`);
    }
    const four = await fetch(`${API_BASE}/diary/entries/${state.activityId}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerApi.accessToken}` },
      body: fd,
    });
    expect(four.status, '4 photos rejected (maximum 3 allowed)').toBe(400);
    // Photo modal accepts jpeg and the upload endpoint enforces the 5 MB ceiling —
    // exercised in TC-FRM-77 step 4.
  });

  test('TC-FRM-76: Edit and delete a diary entry', async ({ farmerPage: page, farmerApi }) => {
    // --- Step 1: edit the urea expense 2400 → 2600 ---
    await page.goto('/farmer/diary');
    const row = page.locator('tr', { hasText: T.urea });
    await expect(row).toBeVisible();
    await row.getByTitle('Edit entry').click();
    await expect(page.getByRole('heading', { name: 'Edit Farm Diary Entry' })).toBeVisible();
    const amount = page.locator('form input[type=number]');
    await expect(amount).toHaveValue('2400');
    await amount.fill('2600');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/diary entry updated/i)).toBeVisible();
    await expect(page.locator('tr', { hasText: T.urea })).toContainText(`-${formatINR(2600)}`);
    const updated = await findEntry(farmerApi.accessToken, T.urea);
    expect(updated?.amount).toBe(2600);

    // --- Step 2: delete another entry (the TC-FRM-75 activity) ---
    const victim = page.locator('tr', { hasText: T.activity });
    await expect(victim).toBeVisible();
    await victim.getByTitle('Delete entry').click();
    await expect(page.getByText(/diary entry deleted/i)).toBeVisible();
    await expect(page.locator('tr', { hasText: T.activity })).toHaveCount(0);
    expect(await findEntry(farmerApi.accessToken, T.activity)).toBeNull();
    expect(state.activityId).toBeTruthy();

    // --- Step 3: deleted id / another farmer's entry → 404 ENTRY_NOT_FOUND ---
    const del = await api.del(`/diary/entries/${state.activityId}`, farmerApi.accessToken);
    expect(del.status).toBe(404);
    expect(del.body?.error?.code ?? del.body?.detail?.code).toBe('ENTRY_NOT_FOUND');

    const strangerToken = await throwawayUser('farmer');
    const foreign = await api.put(
      `/diary/entries/${state.ureaId}`,
      { title: 'hijack', category: 'Other', type: 'expense', amount: 1, date: today() },
      strangerToken,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body?.error?.code ?? foreign.body?.detail?.code).toBe('ENTRY_NOT_FOUND');
    // Original untouched
    expect((await findEntry(farmerApi.accessToken, T.urea))?.amount).toBe(2600);
  });

  test('TC-FRM-77: Diary form validation (negative)', async ({ farmerPage: page, farmerApi }) => {
    await page.goto('/farmer/diary');
    await page.getByRole('button', { name: /add diary entry/i }).click();
    const modal = page.locator('form');
    const heading = page.getByRole('heading', { name: 'Add Farm Diary Entry' });
    const savedCount = async () => {
      const { body } = await api.get('/diary/entries', farmerApi.accessToken, { q: T.probe });
      return body?.total ?? 0;
    };

    // --- Step 1: empty title + amount → required-field errors, nothing saved ---
    await modal.getByPlaceholder(/urea purchase/i).fill('');
    await modal.locator('input[type=number]').fill('');
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(heading).toBeVisible(); // modal stays open (native required validation)
    expect(await savedCount()).toBe(0);

    // --- Step 2: amount −100 → rejected, nothing saved ---
    await modal.getByPlaceholder(/urea purchase/i).fill(T.probe);
    await modal.locator('input[type=number]').fill('-100');
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(heading).toBeVisible(); // min=0 blocks submit
    expect(await savedCount()).toBe(0);

    // --- Step 3: amount "abc" → only numbers accepted ---
    try {
      await modal.locator('input[type=number]').fill('abc'); // number input refuses non-numerics
    } catch {
      /* fill itself rejected the malformed value */
    }
    await page.getByRole('button', { name: /save entry to diary/i }).click();
    await expect(heading).toBeVisible();
    expect(await savedCount()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(heading).toHaveCount(0);

    // --- Step 4: 6 MB photo → size error (jpeg/png/webp ≤ 5 MB) ---
    const { status, body } = await api.post('/diary/entries', {
      title: T.probe,
      category: 'Other',
      type: 'expense',
      amount: 100,
      date: today(),
    }, farmerApi.accessToken);
    expect(status).toBe(201);
    const probeId = body.entry.id as string;
    await page.reload();
    const probeRow = page.locator('tr', { hasText: T.probe });
    await probeRow.getByTitle('Attach photo').click();
    await page.locator('input[type=file]').setInputFiles('/tmp/uat-diary-photo-big.jpg');
    await expect(page.locator('div.bg-rose-50').first()).toContainText(/5 mb/i, { timeout: 15_000 });
    await page.keyboard.press('Escape');
    await api.del(`/diary/entries/${probeId}`, farmerApi.accessToken);
  });

  test('TC-FRM-78: Receipt scan (OCR prefill, confirm-only)', () => {
    test.skip(
      true,
      'TC-FRM-78: needs a physical paper receipt photographed via the app camera + OCR — no web entry point exists (FarmDiaryView has no receipt-scan UI; /diary/receipt-scan is API-only)',
    );
  });

  test('TC-FRM-79: Diary filters, search and analytics summary', async ({ farmerPage: page, farmerApi }) => {
    // Preconditions: the TC-FRM-74 urea expense exists (still ₹2,600 after edit).
    const { body: filtered } = await api.get('/diary/entries', farmerApi.accessToken, {
      type: 'expense',
      category: 'Fertilizers',
      from: '2026-10-01',
      to: '2026-10-31',
      q: 'urea',
      pageSize: '50',
    });
    const match = (filtered?.data ?? []).find((e: any) => e.title === T.urea);
    expect(match, 'filter type+category+date-range+search "urea" finds the entry (API)').toBeTruthy();

    await page.goto('/farmer/diary');
    await expect(page.locator('tr', { hasText: T.urea })).toBeVisible();

    // --- Steps 1-2 (UI): filter controls + search box on the diary page ---
    // manual: Diary → filter type/category/date → Apply; search box "urea".
    expect.soft(page.getByPlaceholder(/search/i), 'diary search box (manual step 2)').toBeVisible({ timeout: 4_000 });
    expect.soft(
      page.getByRole('button', { name: /apply|filter/i }),
      'diary filter Apply control (manual step 1)',
    ).toBeVisible({ timeout: 4_000 });

    // --- Step 3: Diary Analytics — summary with totals, top expense, entry count ---
    const { body: summary } = await api.get('/diary/analytics/summary', farmerApi.accessToken);
    expect(summary?.totals?.entryCount).toBeGreaterThan(0);
    const cat = (summary?.byCategory ?? []).find((c: any) => c.category === 'Fertilizers' && c.type === 'expense');
    expect(cat, 'analytics byCategory includes Fertilizers expense').toBeTruthy();

    await page.goto('/farmer/pnl');
    await expect(page.getByText('Diary Analytics')).toBeVisible();
    const analyticsBlock = page
      .getByText('Diary Analytics')
      .locator('xpath=ancestor::div[contains(@class,"pt-3")][1]');
    await expect(analyticsBlock).toContainText('Entries');
    await expect(analyticsBlock).toContainText('Top Expense');
    const blockText = await analyticsBlock.innerText();
    expect
      .soft(/Entries\s+0/.test(blockText), 'analytics entry count rendered (backend sends totals.entryCount)')
      .toBe(false);
    expect
      .soft(/Top Expense\s+—/.test(blockText), 'analytics top-expense category rendered (backend sends byCategory)')
      .toBe(false);
  });

  test('TC-FRM-80: Diary report — PDF and CSV for a date range', async ({ farmerPage: page, farmerApi }) => {
    // --- Steps 1-3 (UI): Diary → Report (PDF) for current month, regenerate for
    // a changed range, then download report.csv ---
    await page.goto('/farmer/diary');
    expect.soft(
      page.getByRole('button', { name: /report|download/i }),
      'diary report PDF/CSV download controls (manual steps 1-3)',
    ).toBeVisible({ timeout: 4_000 });

    // Backend evidence that the report pipeline itself works for the current month.
    const { status, body } = await api.get('/diary/report', farmerApi.accessToken);
    expect(status).toBe(200);
    expect(typeof body?.reportUrl).toBe('string');
    expect(body?.entryCount).toBeGreaterThan(0);
    expect(body?.from).toBe('2026-10-01');

    const csv = await api.get('/diary/report.csv', farmerApi.accessToken);
    expect(csv.status).toBe(200);
    expect(String(csv.body)).toContain('date,title,category');
    expect(String(csv.body)).toContain(T.urea); // same data as the UI list
  });

  test('TC-FRM-81: P&L dashboard and break-even calculator', async ({ farmerPage: page, farmerApi }) => {
    // Expected totals straight from the cashbook this season (all personas' entries
    // included — the app sums the whole ledger).
    const { body: entries } = await api.get('/diary/entries', farmerApi.accessToken, { pageSize: '200' });
    const all = entries?.data ?? [];
    const income = all.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.amount, 0);
    const expense = all.filter((e: any) => e.type === 'expense').reduce((s: number, e: any) => s + e.amount, 0);

    // --- Step 1: cards Total Income / Total Expenses / Net Profit match diary ---
    await page.goto('/farmer/pnl');
    await expect(page.getByRole('heading', { name: /farm p&l dashboard/i })).toBeVisible();
    for (const label of ['Total Income', 'Total Expenses', 'Net Profit']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    const card = (label: string) =>
      page.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');
    const cardAmount = async (label: string) => {
      const txt = await card(label).innerText();
      const m = txt.match(/₹([\d,]+)/);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN;
    };
    // Backend contract check: /pnl/summary derives from crop_pnl, not the cashbook.
    const { body: pnlSummary } = await api.get('/pnl/summary', farmerApi.accessToken);
    const apiIncome = pnlSummary?.grossIncome ?? pnlSummary?.totalIncome ?? 0;
    expect
      .soft(
        apiIncome === income,
        `/pnl/summary grossIncome (${apiIncome}) should equal diary income total (${income})`,
      )
      .toBe(true);
    expect.soft(await cardAmount('Total Income'), 'Total Income card matches diary entries').toBe(income);
    expect.soft(await cardAmount('Total Expenses'), 'Total Expenses card matches diary entries').toBe(expense);
    expect.soft(await cardAmount('Net Profit'), 'Net Profit card matches diary entries').toBe(income - expense);

    // --- Step 2: income/expense breakdown itemised (crop-wise economics shown) ---
    await expect(page.getByRole('heading', { name: /crop-wise economics/i })).toBeVisible();

    // --- Step 3: break-even calculator ₹40,000 cost @ ₹1,450/q → Calculate ---
    const beCard = page
      .getByRole('heading', { name: /break-even calculator/i })
      .locator('xpath=ancestor::div[contains(@class,"bg-white")][1]');
    const beInputs = beCard.locator('input[type=number]');
    await beInputs.nth(0).fill('40000');
    await beInputs.nth(1).fill('1450');
    // The UI payload omits required expectedYieldQuintals → backend 422.
    const uiPayload = await api.post('/pnl/break-even', {
      totalCost: 40000,
      costPerQuintal: 40000,
      expectedPricePerQuintal: 1450,
      pricePerQuintal: 1450,
    }, farmerApi.accessToken);
    expect(uiPayload.status, 'backend requires expectedYieldQuintals (UI omits it)').toBe(422);
    await beCard.getByRole('button', { name: /compute break-even/i }).click();
    await expect(page.locator('div.bg-rose-50').first()).toContainText(/validation/i);
    expect
      .soft(beCard.getByText('Break-even Yield'), 'break-even yield shown after Calculate')
      .toBeVisible();

    // --- Step 4: Season Report (PDF) downloads ---
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /season report/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('farm-pnl-report.pdf');
  });

  test('TC-FRM-82: Automatic P&L entries from sales and orders', async ({ farmerPage: page, farmerApi }) => {
    // Setup [API]: ensure a sold lot exists — create an open lot and have a
    // throwaway buyer purchase it (mirrors TC-FRM-47's seller side).
    const rate = 1471;
    const qty = 2;
    const { status: lotStatus, body: lot } = await api.post('/market/lots', {
      crop: 'Onion',
      variety: FARMER.lotOnion.variety,
      grade: 'A',
      quantityQuintals: qty,
      expectedRate: rate,
      harvestDate: today(),
      village: FARMER.village,
      submitForReview: false,
    }, farmerApi.accessToken);
    expect(lotStatus).toBe(201);
    expect(lot?.status).toBe('open');

    const buyerToken = await throwawayUser('customer');
    const { status: puStatus, body: purchase } = await api.post('/purchases', {
      lotId: lot.id,
      quantity: qty,
    }, buyerToken);
    expect(puStatus).toBe(201);
    state.purchaseId = purchase.id;
    state.lotSaleAmount = qty * rate; // ₹2,942

    // --- Step 1: P&L income shows auto entry lot_sale with the sold amount ---
    const { body: entries } = await api.get('/diary/entries', farmerApi.accessToken, { pageSize: '200' });
    const auto = (entries?.data ?? []).filter((e: any) => e.auto);
    const lotSale = auto.find((e: any) => e.sourceKind === 'lot_sale' && e.sourceId === state.purchaseId);
    expect(lotSale, 'auto lot_sale income entry exists for the sold lot').toBeTruthy();
    expect(lotSale.type).toBe('income');
    expect(lotSale.amount).toBe(state.lotSaleAmount);
    expect(lotSale.id).toBe(`auto_lot_sale__${state.purchaseId}`);
    // Exactly one auto entry per source (idempotent, no duplicates).
    expect(auto.filter((e: any) => e.sourceId === state.purchaseId)).toHaveLength(1);

    // --- Step 2: P&L expenses show auto entry marketplace_order ---
    const orderAutos = auto.filter((e: any) => e.sourceKind === 'marketplace_order');
    expect(orderAutos.length, 'at least one marketplace_order auto expense entry').toBeGreaterThan(0);

    // UI: the auto entries are listed in the farm diary ledger (the P&L itself
    // has no per-entry list). Other suites may have created their own lot_sale
    // rows, so pin the row by this run's unique amount.
    await page.goto('/farmer/diary');
    const lotSaleRow = page
      .locator('tr', { hasText: 'lot_sale' })
      .filter({ hasText: `+${formatINR(state.lotSaleAmount!)}` });
    await expect(lotSaleRow).toBeVisible();
    await expect(page.locator('tr', { hasText: 'marketplace_order' }).first()).toBeVisible();

    // --- Step 3: tapping an auto entry shows its source (lot/order id) ---
    expect
      .soft(
        lotSaleRow.getByText(new RegExp(state.purchaseId!, 'i')),
        'auto entry shows its source lot/order id',
      )
      .toBeVisible();
  });
});

/** en-IN currency formatting, mirroring website/src/lib/utils formatCurrency. */
function formatINR(amount: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}
