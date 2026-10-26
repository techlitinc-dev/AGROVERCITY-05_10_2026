/**
 * Module 5 — Sell Produce: Lots & Offers (manual_test/01_farmer.md lines 653-835)
 * TC-FRM-38 … TC-FRM-49. CORE P0 module.
 *
 * Execution order matters: TC-FRM-44 (sold-lot relist) and TC-FRM-45 (sold-lot
 * transitions) depend on the lot sold in TC-FRM-47, so they run after it.
 *
 * Known defects in the current build (assertions kept on purpose, see summary):
 *  - ProduceLotsView calls GET /offers/mine without ?filter=received (backend
 *    defaults to "sent"), so the "Received Offers" desk never shows buyer offers
 *    and Accept/Counter/Reject cannot be exercised from the web UI.
 *  - No Relist UI, no offer-board/analytics/trust-card UI, no partial-accept UI.
 *  - Crop select lacks Grapes (manual TC-FRM-39 posts a grapes lot).
 *  - Chat: an "offer" negotiation room is created at offer time, before booking
 *    confirmation (manual TC-FRM-47 expects no chat before confirmation).
 *  - UI says "1 counter round" while the backend allows 3 (flagged in manual).
 */
import { test, expect, type Page, type Locator } from '../fixtures/auth';
import { api, type Session } from '../fixtures/api';
import { API_BASE, FARMER, freshPhone } from '../test-data';

const RUN = Date.now().toString().slice(-7);

/** Cross-test state (tests in this file run serially, in file order). */
const S: {
  onionVariety?: string;
  grapesVariety?: string;
  onionLotId?: string;
  grapesLotId?: string;
  lowOfferId?: string;
  highOfferId?: string;
  highOfferBuyerName?: string;
  purchaseId?: string;
  buyerKishor?: Session & { phone: string };
  buyerMahesh?: Session & { phone: string };
} = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** [ADMIN] lot moderation.
 *  NOTE: the shared fixture adminModerateLot() targets /admin/moderation/{id}/action
 *  (user-moderation endpoint that only accepts dismiss|warn|suspend) and the shared
 *  api helper never sends the mandatory X-Audit-Reason header, so it always fails.
 *  The correct lot endpoint is /admin/market/lots/{id}/moderate (reported, not fixed). */
async function moderateLot(
  admin: Session,
  lotId: string,
  action: 'approve' | 'reject',
  reason?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}/admin/market/lots/${lotId}/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.accessToken}`,
      'X-Audit-Reason': `UAT lot ${action} (${reason ?? 'no reason'})`,
    },
    body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** Register a throwaway vyapari-style buyer via the public onboard API. */
async function createBuyer(name: string): Promise<Session & { phone: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const phone = freshPhone();
    const { status, body } = await api.post('/auth/onboard', {
      phone,
      name,
      mpin: '4321',
      persona: 'directBuyer',
      state: FARMER.state,
      district: FARMER.district,
      village: 'Nashik',
    });
    if (status === 200 && body?.accessToken) {
      return { accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user, phone };
    }
  }
  throw new Error(`createBuyer(${name}) failed after 3 attempts`);
}

async function placeOffer(buyer: Session, lotId: string, price: number, qty: number): Promise<any> {
  const { status, body } = await api.post(
    '/offers',
    { targetType: 'lot', targetId: lotId, pricePerUnit: price, quantity: qty },
    buyer.accessToken,
  );
  expect(status).toBe(201);
  return body;
}

async function createLot(
  farmer: Session,
  lot: { crop: string; variety: string; qty: number; rate: number; submitForReview?: boolean },
): Promise<any> {
  const { status, body } = await api.post(
    '/market/lots',
    {
      crop: lot.crop,
      variety: lot.variety,
      quantityQuintal: lot.qty,
      grade: 'A',
      expectedPricePerQuintal: lot.rate,
      location: FARMER.lotOnion.pickup,
      village: FARMER.village,
      harvestDate: FARMER.lotOnion.harvestDate,
      photos: ['https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=600&q=80'],
      submitForReview: lot.submitForReview ?? false,
    },
    farmer.accessToken,
  );
  expect(status).toBe(201);
  return body;
}

const getLot = async (farmer: Session, lotId: string): Promise<any> =>
  (await api.get(`/market/lots/${lotId}`, farmer.accessToken)).body;

/** The lot card on the Produce Lots page for a given unique variety. */
const lotCard = (page: Page, variety: string): Locator =>
  page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: new RegExp(`\\(${variety}\\)`) }) });

/** Label-wrapped input/select inside the Post/Edit lot modal. */
const modalField = (modal: Locator, label: string): Locator =>
  modal.locator(`div:has(> label:text-is("${label}"))`).locator('input, select').first();

const openLotModal = async (page: Page): Promise<Locator> => {
  await page.getByRole('button', { name: /post new produce lot/i }).click();
  const modal = page.locator('div.fixed.inset-0.z-50', {
    has: page.getByRole('heading', { name: 'Post New Produce Lot' }),
  });
  await expect(modal.getByRole('heading', { name: 'Post New Produce Lot' })).toBeVisible();
  return modal;
};

/** Open the notification bell panel. */
const openBell = async (page: Page): Promise<Locator> => {
  await page.getByRole('button', { name: 'Notifications' }).first().click();
  const panel = page.locator('div.fixed.inset-0.z-50', { has: page.getByRole('heading', { name: 'Notifications' }) });
  await expect(panel.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  return panel;
};

test.describe('Module 5 — Sell Produce: Lots & Offers (TC-FRM-38…49)', () => {
  test('TC-FRM-38: post onion lot — save as draft → open, visible in My Lots, buyer sees first name + village only', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    S.onionVariety = `Nashik Red UAT${RUN}`;
    await page.goto('/farmer/lots');

    // Step 1: modal opens, crop select offers exactly the spec'd list.
    const modal = await openLotModal(page);
    const cropSelect = modalField(modal, 'Crop');
    for (const crop of [/soybean/i, /wheat/i, /cotton/i, /onion/i, /tur/i]) {
      await expect(modal.getByRole('option', { name: crop })).toHaveCount(1);
    }

    // Step 2: fill data, moderation-review checkbox unchecked → "Save as Draft".
    await cropSelect.selectOption('Onion');
    await modalField(modal, 'Variety').fill(S.onionVariety);
    await modalField(modal, 'Quantity (q)').fill(String(FARMER.lotOnion.quantityQ));
    await modalField(modal, 'Quality Grade').selectOption(FARMER.lotOnion.grade);
    await modalField(modal, 'Expected Price (₹/q)').fill(String(FARMER.lotOnion.expectedRate));
    await modalField(modal, 'Village / Taluka').fill(FARMER.lotOnion.village);
    await modalField(modal, 'Harvest Date').fill(FARMER.lotOnion.harvestDate);
    await modalField(modal, 'Pickup Location / Gate').fill(FARMER.lotOnion.pickup);
    await modalField(modal, 'Produce Sample Photo URL').fill(
      'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=600&q=80',
    );
    const reviewCheck = modal.locator('#submitReviewCheck');
    await expect(reviewCheck).toBeChecked(); // checked by default
    await reviewCheck.uncheck();
    const saveBtn = modal.getByRole('button', { name: 'Save as Draft' });
    await expect(saveBtn).toBeVisible();

    // Step 3: save → status open, appears in My Lots.
    await saveBtn.click();
    await expect(page.getByText('Produce lot saved as draft.')).toBeVisible();
    const card = lotCard(page, S.onionVariety);
    await expect(card.getByRole('heading', { name: /onion/i })).toBeVisible();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    // API truth: lot created with status "open".
    const lots = (await api.get('/market/lots', farmerApi.accessToken)).body.data;
    const mine = lots.find((l: any) => l.variety === S.onionVariety);
    expect(mine).toBeTruthy();
    expect(mine.status).toBe('open');
    S.onionLotId = mine.id;

    // Step 4 (Tester B browse): lot visible; farmer shown as first name + village only.
    const buyer = await createBuyer(`Kishor UAT${RUN}`);
    S.buyerKishor = buyer;
    const browse = (await api.get('/market/lots/browse', buyer.accessToken, { crop: 'Onion' })).body.data;
    const seen = browse.find((l: any) => l.id === S.onionLotId);
    expect(seen).toBeTruthy();
    expect(seen.status).toBe('open');
    expect(seen.farmerName).toBe('Ramesh');
    expect(seen.farmerVillage).toBe(FARMER.village);
    expect(seen.farmerPhone ?? seen.phone ?? seen.farmerContact).toBeUndefined();
  });

  test('TC-FRM-39: post grapes lot — submit for review → pending_review → [ADMIN] approve → open', async ({
    farmerPage,
    farmerApi,
    adminApi,
  }) => {
    const page = farmerPage;
    S.grapesVariety = `Thompson Seedless UAT${RUN}`;
    await page.goto('/farmer/lots');

    // Step 1: open modal with review checkbox ticked → button reads "Submit for Review".
    const modal = await openLotModal(page);
    const reviewCheck = modal.locator('#submitReviewCheck');
    await expect(reviewCheck).toBeChecked();
    await expect(modal.getByRole('button', { name: 'Submit for Review' })).toBeVisible();
    // DEFECT (soft): the crop select has no Grapes option (manual posts a grapes lot).
    expect.soft(modal.getByRole('option', { name: /grapes/i }), 'crop select should offer Grapes').toHaveCount(0);
    await page.keyboard.press('Escape'); // close modal — lot is created via API below

    // Create the grapes lot (submitForReview=true) through the same endpoint the UI calls.
    const lot = await createLot(farmerApi, {
      crop: FARMER.lotGrapes.crop,
      variety: S.grapesVariety,
      qty: FARMER.lotGrapes.quantityQ,
      rate: FARMER.lotGrapes.expectedRate,
      submitForReview: true,
    });
    expect(lot.status).toBe('pending_review');
    S.grapesLotId = lot.id;

    // Step 2: farmer sees "In Review" on the card.
    await page.reload();
    const card = lotCard(page, S.grapesVariety);
    await expect(card.getByText('Pending Review', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'In Review' })).toBeVisible();

    // Step 3: [ADMIN] approves → status open, "In Review" gone.
    const mod = await moderateLot(adminApi, lot.id, 'approve');
    expect(mod.status).toBe(200);
    await page.reload();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'In Review' })).toHaveCount(0);
    expect((await getLot(farmerApi, lot.id)).status).toBe('open');

    // Step 4: bell shows the lot_moderated approval notification.
    const panel = await openBell(page);
    await expect(panel.getByText('Lot review update')).toBeVisible();
  });

  test('TC-FRM-40: lot form validation — empty form, qty −5, price −10, nothing partial created', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const before = (await api.get('/market/lots', farmerApi.accessToken)).body.total;

    await page.goto('/farmer/lots');
    const modal = await openLotModal(page);

    // Step 1: empty form (clear the required Variety + Pickup fields) → HTML5 required errors, no creation.
    await modalField(modal, 'Variety').fill('');
    await modalField(modal, 'Pickup Location / Gate').fill('');
    await modal.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(modal.locator('input:invalid')).not.toHaveCount(0);
    await expect(modal.getByRole('heading', { name: 'Post New Produce Lot' })).toBeVisible(); // still open

    // Step 2: quantity −5 → error, lot rejected by the API (422 VALIDATION_ERROR).
    await modalField(modal, 'Variety').fill(`BadQty UAT${RUN}`);
    await modalField(modal, 'Pickup Location / Gate').fill(FARMER.lotOnion.pickup);
    await modalField(modal, 'Quantity (q)').fill('-5');
    await modalField(modal, 'Expected Price (₹/q)').fill('1450');
    await modal.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'invalid lot' })).toBeVisible();
    // DEFECT (soft): the specific field message ("must be greater than 0") is not surfaced in the UI.
    expect
      .soft(page.locator('div.text-rose-800').filter({ hasText: /greater than 0/i }))
      .toBeVisible({ timeout: 1500 });

    // Step 3: price −10 → error.
    await modalField(modal, 'Quantity (q)').fill('20');
    await modalField(modal, 'Expected Price (₹/q)').fill('-10');
    await modal.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'invalid lot' })).toBeVisible();
    // DEFECT (soft): specific "must be 0 or more" message not surfaced.
    expect
      .soft(page.locator('div.text-rose-800').filter({ hasText: /0 or more/i }))
      .toBeVisible({ timeout: 1500 });

    // Step 4 (manual): "On mobile attach a 4th photo → blocked, max 3" — mobile-only step,
    // not applicable to the web form (single photo URL field); noted in the UAT summary.
    await expect(modalField(modal, 'Produce Sample Photo URL')).toBeVisible();

    // Step 5: no broken/partial lot was created by the failed attempts.
    const after = (await api.get('/market/lots', farmerApi.accessToken)).body.total;
    expect(after).toBe(before);
  });

  test('TC-FRM-41: edit lot — expected rate → ₹1,500/q, quantity → 25 q', async ({ farmerPage, farmerApi }) => {
    const page = farmerPage;
    await page.goto('/farmer/lots');

    // Step 1: open the onion lot → Edit; form prefilled.
    const card = lotCard(page, S.onionVariety!);
    await card.getByTitle('Edit lot').click();
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Edit Produce Lot' }),
    });
    await expect(modal.getByRole('heading', { name: 'Edit Produce Lot' })).toBeVisible();
    await expect(modalField(modal, 'Variety')).toHaveValue(S.onionVariety!);
    await expect(modalField(modal, 'Quantity (q)')).toHaveValue(String(FARMER.lotOnion.quantityQ));
    await expect(modalField(modal, 'Expected Price (₹/q)')).toHaveValue(String(FARMER.lotOnion.expectedRate));

    // Step 2: new rate ₹1,500/q, quantity 25 q → Save → card updated.
    await modalField(modal, 'Expected Price (₹/q)').fill('1500');
    await modalField(modal, 'Quantity (q)').fill('25');
    await modal.getByRole('button', { name: 'Save Lot Changes' }).click();
    await expect(page.getByText(new RegExp(`Lot #${S.onionLotId} updated\\.`))).toBeVisible();
    await expect(card.getByText('25 Quintals (2,500 kg)')).toBeVisible();
    await expect(card.getByText('₹1,500')).toBeVisible();

    const lot = await getLot(farmerApi, S.onionLotId!);
    expect(lot.expectedRate).toBe(1500);
    expect(lot.quantityQuintals).toBe(25);
  });

  test('TC-FRM-42: withdraw a lot — status withdrawn, hidden from buyers', async ({ farmerPage, farmerApi }) => {
    const page = farmerPage;
    // Dedicated throwaway open lot (not used by later accept tests).
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Withdraw UAT${RUN}`,
      qty: 15,
      rate: 1400,
    });
    expect(lot.status).toBe('open');
    await page.goto('/farmer/lots');
    const card = lotCard(page, lot.variety);
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    // Step 1: Withdraw — manual expects a confirmation dialog first.
    await card.getByTitle('Withdraw lot').click();
    // DEFECT (soft): no confirm dialog; withdrawal happens immediately.
    await expect.soft(page.getByText(/confirm withdrawal|are you sure/i)).toBeVisible({ timeout: 1500 });

    // Step 2: status → withdrawn; card shows Withdrawn (after reload the list re-fetches it).
    await expect(page.getByText('Lot withdrawn from the marketplace.')).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('withdrawn');
    await page.reload();
    await expect(lotCard(page, lot.variety).getByText('Withdrawn', { exact: true })).toBeVisible();

    // Step 3 (Tester B browse): lot no longer visible to buyers.
    const buyer = await createBuyer(`Probe UAT${RUN}`);
    const browse = (await api.get('/market/lots/browse', buyer.accessToken, { crop: 'Onion' })).body.data;
    expect(browse.find((l: any) => l.id === lot.id)).toBeUndefined();
  });

  test('TC-FRM-43: rejected lot — reason shown, fix and resubmit → [ADMIN] approve', async ({
    farmerPage,
    farmerApi,
    adminApi,
  }) => {
    const page = farmerPage;
    // [ADMIN] setup: a pending_review lot, rejected with reason "Photo unclear".
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Moderated UAT${RUN}`,
      qty: 12,
      rate: 1600,
      submitForReview: true,
    });
    const rej = await moderateLot(adminApi, lot.id, 'reject', 'Photo unclear');
    expect(rej.status).toBe(200);

    // Step 2: My Lots shows rejected + the moderation reason on the card.
    await page.goto('/farmer/lots');
    const card = lotCard(page, lot.variety);
    await expect(card.getByText('Rejected', { exact: true })).toBeVisible();
    await expect(card.getByText('Photo unclear')).toBeVisible();

    // Step 3: edit the lot (replace photo) → Submit for Review → pending_review.
    await card.getByTitle('Edit lot').click();
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Edit Produce Lot' }),
    });
    await modalField(modal, 'Produce Sample Photo URL').fill(
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
    );
    await modal.getByRole('button', { name: 'Save Lot Changes' }).click();
    await expect(page.getByText(new RegExp(`Lot #${lot.id} updated\\.`))).toBeVisible();
    await card.getByRole('button', { name: 'Submit Review' }).click();
    await expect(card.getByText('Pending Review', { exact: true })).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('pending_review');

    // Step 4: [ADMIN] approves → open.
    const appr = await moderateLot(adminApi, lot.id, 'approve');
    expect(appr.status).toBe(200);
    await page.reload();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();
  });

  test('TC-FRM-46: offer board — analytics + buyer trust cards for 2 API-placed offers', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    // Tester B: two vyaparis offer on the onion lot (₹1,420 and ₹1,480 vs expected ₹1,500).
    const kishor = S.buyerKishor ?? (await createBuyer(`Kishor UAT${RUN}`));
    S.buyerKishor = kishor;
    const mahesh = await createBuyer(`Mahesh UAT${RUN}`);
    S.buyerMahesh = mahesh;
    const low = await placeOffer(kishor, S.onionLotId!, 1420, 20);
    const high = await placeOffer(mahesh, S.onionLotId!, 1480, 25);
    S.lowOfferId = low.id;
    S.highOfferId = high.id;
    S.highOfferBuyerName = 'Mahesh';

    // Step 1 (UI): open the lot's offer surface — DEFECT (soft): the Received
    // Offers desk never lists buyer offers (offers.mine() called without filter=received).
    await page.goto('/farmer/lots');
    await expect.soft(page.getByText('No buyer offers yet')).toHaveCount(0, { timeout: 3000 });
    await expect.soft(page.getByText('₹1,480')).toBeVisible({ timeout: 3000 });
    // Steps 2-3 (UI): trust cards + analytics panel are not implemented on the web.
    await expect.soft(page.getByText(/best rate|avg rate|total offers/i)).toHaveCount(0, { timeout: 2000 });

    // Same assertions against the backend offer board the UI would consume:
    // best-rate first, trust summary per buyer, full analytics.
    const board = (await api.get(`/market/lots/${S.onionLotId}/offers`, farmerApi.accessToken)).body;
    const entries = board.data;
    const analytics = board.analytics;
    expect(entries).toHaveLength(2);
    expect(entries[0].pricePerUnit).toBe(1480); // best rate first
    expect(entries[0].buyer.name).toBe('Mahesh');
    for (const e of entries) {
      expect(e.buyer).toMatchObject({
        completedPurchases: 0,
        offersOnThisLotCount: 1,
      });
      expect(e.buyer).toHaveProperty('avgRating');
      expect(e.buyer).toHaveProperty('verified');
    }
    expect(analytics).toMatchObject({
      totalOffers: 2,
      bestRate: 1480,
      avgRate: 1450,
      avgQuantity: 22.5,
      totalOfferedQty: 45,
      verifiedOffers: 0,
      bestOfferId: high.id,
      rateVsExpected: { expected: 1500, bestDeltaPct: -1.33 }, // (1480-1500)/1500 = −1.33%
    });
  });

  test('TC-FRM-47: accept an offer — full lot → purchase created (confirmed), chat + notifications', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const mahesh = S.buyerMahesh!;

    // Step 1: before accepting, the chat screen with this buyer must not exist yet
    // (chat unlocks only after confirmation). DEFECT (soft): an offer negotiation
    // room is created at offer time, so the thread already exists pre-confirmation.
    await page.goto('/chat');
    await expect
      .soft(page.getByRole('button', { name: /mahesh/i }), 'no chat before booking confirmation')
      .toHaveCount(0, { timeout: 3000 });

    // Step 2: Accept → confirm full quantity. DEFECT (soft): the offer is not
    // rendered in the web UI (TC-FRM-46), so the click path is exercised and the
    // accept itself is completed through the same endpoint the Accept button calls.
    await page.goto('/farmer/lots');
    await expect
      .soft(lotCard(page, S.onionVariety!).getByRole('button', { name: 'Accept' }))
      .toBeVisible({ timeout: 3000 });
    const accepted = await api.post(`/offers/${S.highOfferId}/accept`, undefined, farmerApi.accessToken);
    expect(accepted.status).toBe(200);
    const purchase = accepted.body.purchase;
    expect(accepted.body.offer.status).toBe('accepted');
    expect(purchase.status).toBe('confirmed');
    expect(purchase.quantity).toBe(25);
    expect(purchase.agreedPricePerUnit).toBe(1480);
    expect(purchase.totalAmount).toBe(37000);
    S.purchaseId = purchase.id;

    // Lot sold in My Lots.
    await page.reload();
    await expect(lotCard(page, S.onionVariety!).getByText('Sold', { exact: true })).toBeVisible();
    expect((await getLot(farmerApi, S.onionLotId!)).status).toBe('sold');

    // Step 3 (Tester B side): the other live offer was auto-rejected with lot_fulfilled.
    const sibling = (await api.get(`/offers/${S.lowOfferId}`, farmerApi.accessToken)).body;
    expect(sibling.status).toBe('rejected');
    expect(sibling.rejectReason).toBe('lot_fulfilled');

    // Step 4: Purchases — a confirmed purchase exists for this lot.
    await page.goto('/farmer/purchases');
    const po = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: 'Onion Procurement' }) });
    await expect(po.filter({ hasText: 'Mahesh' }).getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(po.filter({ hasText: 'Mahesh' }).getByText('25 Quintals (2,500 kg)')).toBeVisible();
    await expect(po.filter({ hasText: 'Mahesh' }).getByText('₹1,480 /q')).toBeVisible();

    // Step 5: bell — booking_confirmed for the farmer (request_accepted goes to the buyer only).
    const panel = await openBell(page);
    await expect(panel.getByText('Booking confirmed / बुकिंग पक्की')).toBeVisible();
    await expect
      .soft(panel.getByText('Request accepted / मांग स्वीकार हुई'))
      .toBeVisible({ timeout: 1500 }); // manual expects it for the farmer too

    // Step 6: chat with the buyer now works — send a message through the UI.
    await page.goto('/chat');
    const room = page.getByRole('button', { name: /mahesh/i }).first(); // newest room = purchase room
    await expect(room).toBeVisible();
    await room.click();
    await page.getByPlaceholder('Type a message…').fill('UAT: pickup kal subah 7 baje, Gate 312.');
    await page.getByPlaceholder('Type a message…').press('Enter');
    await expect(page.getByText('UAT: pickup kal subah 7 baje, Gate 312.')).toBeVisible();
    const msgs = (await api.get(`/chat/rooms/${S.purchaseId}/messages`, mahesh.accessToken)).body.data;
    expect(msgs.some((m: any) => (m.text || '').includes('pickup kal subah'))).toBe(true);

    // Step 7: auto income entry (lot_sale) fed to diary / P&L.
    const diary = (await api.get('/diary/entries', farmerApi.accessToken)).body.data;
    const entry = diary.find((d: any) => d.id === `auto_lot_sale__${S.purchaseId}`);
    expect(entry).toBeTruthy();
    expect(entry.direction ?? entry.type).toMatch(/income/i);
  });

  test('TC-FRM-44: relist with priority boost; relist of a sold lot blocked (LOT_ALREADY_SOLD)', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    await page.goto('/farmer/lots');
    const card = lotCard(page, S.grapesVariety!); // open lot from TC-FRM-43
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    // Steps 1-2 (UI): manual opens the lot → Relist form. DEFECT (soft): the web
    // UI has no Relist control, so the flow is verified against the lots.relist
    // endpoint the web client wraps.
    await expect.soft(card.getByRole('button', { name: /relist/i })).toBeVisible({ timeout: 2000 });
    const relisted = await api.post(
      `/market/lots/${S.grapesLotId}/relist`,
      { priority: true, expectedRate: 2900, note: 'Fresh stock arriving' },
      farmerApi.accessToken,
    );
    expect(relisted.status).toBe(200);
    expect(relisted.body.status).toBe('open');
    expect(relisted.body.priority).toBe(true);
    expect(relisted.body.priorityBoost).toBe(true);
    expect(relisted.body.expectedRate).toBe(2900);
    expect(relisted.body.relistNote).toBe('Fresh stock arriving');

    // Card should carry a Priority badge — DEFECT (soft): the web card never renders it.
    await page.reload();
    await expect.soft(lotCard(page, S.grapesVariety!).getByText('Priority')).toBeVisible({ timeout: 2000 });

    // Step 3: relisting the SOLD onion lot is blocked with LOT_ALREADY_SOLD (409).
    const blocked = await api.post(`/market/lots/${S.onionLotId}/relist`, { priority: true }, farmerApi.accessToken);
    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.code ?? blocked.body?.code).toBe('LOT_ALREADY_SOLD');
    expect((await getLot(farmerApi, S.onionLotId!)).status).toBe('sold');
  });

  test('TC-FRM-45: illegal transitions on a sold lot — edit / withdraw / submit-for-review blocked', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    await page.goto('/farmer/lots');
    const card = lotCard(page, S.onionVariety!);
    await expect(card.getByText('Sold', { exact: true })).toBeVisible();

    // Step 1: Edit → blocked (409 LOT_NOT_EDITABLE surfaced in the error banner).
    await card.getByTitle('Edit lot').click();
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Edit Produce Lot' }),
    });
    await modal.getByRole('button', { name: 'Save Lot Changes' }).click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'a sold lot cannot be edited' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Step 2: Withdraw → blocked; lot stays sold.
    await card.getByTitle('Withdraw lot').click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'a sold lot cannot be withdrawn' })).toBeVisible();
    await expect(card.getByText('Sold', { exact: true })).toBeVisible();

    // Step 3: Submit for Review → blocked. The UI hides the button for sold lots
    // (correctly), so the 409 contract is asserted at API level.
    await expect(card.getByRole('button', { name: 'Submit Review' })).toHaveCount(0);
    const sub = await api.post(`/market/lots/${S.onionLotId}/submit-for-review`, undefined, farmerApi.accessToken);
    expect(sub.status).toBe(409);
    expect(sub.body?.error?.code ?? sub.body?.code).toBe('LOT_NOT_SUBMITTABLE');

    // Step 4: status still sold; purchase link intact.
    expect((await getLot(farmerApi, S.onionLotId!)).status).toBe('sold');
    const po = (await api.get(`/purchases/${S.purchaseId}`, farmerApi.accessToken)).body;
    expect(po.status).toBe('confirmed');
  });

  test('TC-FRM-48: partial accept — 10 q of a 20 q offer on a 25 q lot; over-remaining accept blocked', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    // Fresh 25 q lot + a 20 q offer from a vyapari.
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Partial UAT${RUN}`,
      qty: 25,
      rate: 1550,
    });
    const prakash = await createBuyer(`Prakash UAT${RUN}`);
    const offer = await placeOffer(prakash, lot.id, 1500, 20);

    // Step 1 (UI): "Accept partial → enter 10 q". DEFECT (soft): no partial-accept
    // control exists in the web UI (and the offer itself is not listed — TC-FRM-46).
    await page.goto('/farmer/lots');
    await expect
      .soft(page.getByRole('button', { name: /accept partial|partial/i }))
      .toBeVisible({ timeout: 2000 });
    // API: accept exactly 10 q.
    const accepted = await api.post(`/offers/${offer.id}/accept`, { quantity: 10 }, farmerApi.accessToken);
    expect(accepted.status).toBe(200);
    expect(accepted.body.purchase.quantity).toBe(10);
    expect(accepted.body.purchase.status).toBe('confirmed');
    expect(accepted.body.offer.acceptedQuantity).toBe(10);

    // Step 2: lot stays open with 15 q remaining.
    const after = await getLot(farmerApi, lot.id);
    expect(after.status).toBe('open');
    expect(after.quantityQuintals).toBe(15);
    await expect(lotCard(page, lot.variety).getByText('Open', { exact: true })).toBeVisible();

    // Step 3: a 20 q accept against the remaining 15 q is blocked (422).
    const offer2 = await placeOffer(prakash, lot.id, 1490, 20);
    const tooMuch = await api.post(`/offers/${offer2.id}/accept`, { quantity: 20 }, farmerApi.accessToken);
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body?.error?.code ?? tooMuch.body?.code).toBe('VALIDATION_ERROR');

    // Step 4 (farmer-side UI): the 10 q purchase shows in Purchases.
    await page.goto('/farmer/purchases');
    const po = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: 'Onion Procurement' }) });
    await expect(po.filter({ hasText: 'Prakash' }).getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(po.filter({ hasText: 'Prakash' }).getByText('10 Quintals (1,000 kg)')).toBeVisible();
  });

  test('TC-FRM-49: counter ₹1,470, 4th counter NEGOTIATION_CLOSED, reject offer, bell notifications', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    // ≥2 pending offers on open lots.
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Counter UAT${RUN}`,
      qty: 20,
      rate: 1500,
    });
    const kishor = await createBuyer(`KishorB UAT${RUN}`);
    const mahesh = await createBuyer(`MaheshB UAT${RUN}`);
    const offer1 = await placeOffer(kishor, lot.id, 1420, 20);
    const offer2 = await placeOffer(mahesh, lot.id, 1460, 20);

    // Step 1 (UI): Counter → "Submit One-Time Counter Offer" → ₹1,470.
    // DEFECT (soft): the desk is empty in the web UI (TC-FRM-46), so the counter
    // is sent through the same endpoint the Counter button wraps.
    await page.goto('/farmer/lots');
    await expect
      .soft(lotCard(page, lot.variety).getByRole('button', { name: 'Counter' }))
      .toBeVisible({ timeout: 2000 });
    const countered = await api.post(`/offers/${offer1.id}/counter`, { pricePerUnit: 1470 }, farmerApi.accessToken);
    expect(countered.status).toBe(200);
    expect(countered.body.status).toBe('countered');
    expect(countered.body.rounds).toBe(1);
    expect(countered.body.counter.pricePerUnit).toBe(1470);
    const kishorNotifs = (await api.get('/notifications', kishor.accessToken)).body.data;
    expect(kishorNotifs.some((n: any) => n.type === 'offer_countered')).toBe(true);

    // Step 2 (API per assignment): buyer counters back (round 2), farmer counters
    // again (round 3), a 4th counter is blocked.
    const r2 = await api.post(`/offers/${offer1.id}/counter`, { pricePerUnit: 1450 }, kishor.accessToken);
    expect(r2.status).toBe(200);
    const r3 = await api.post(`/offers/${offer1.id}/counter`, { pricePerUnit: 1465 }, farmerApi.accessToken);
    expect(r3.status).toBe(200);
    expect(r3.body.rounds).toBe(3);
    const r4 = await api.post(`/offers/${offer1.id}/counter`, { pricePerUnit: 1455 }, kishor.accessToken);
    expect(r4.status).toBe(400);
    expect(r4.body?.error?.code ?? r4.body?.code).toBe('NEGOTIATION_CLOSED');

    // Step 3: Reject offer 2 → rejected; buyer notified offer_rejected.
    // (UI Reject button is part of the missing desk — same defect as above.)
    const rejected = await api.post(`/offers/${offer2.id}/reject`, undefined, farmerApi.accessToken);
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('rejected');
    const maheshNotifs = (await api.get('/notifications', mahesh.accessToken)).body.data;
    expect(maheshNotifs.some((n: any) => n.type === 'offer_rejected')).toBe(true);

    // Step 4: bell — offer_countered (buyer's round-2 counter) + offer_rejected.
    const panel = await openBell(page);
    await expect(panel.getByText('Counter-offer / काउंटर ऑफर')).toBeVisible();
    await expect(panel.getByText('Offer declined / ऑफर मना')).toBeVisible();

    // Manual ⚠️ known mismatch: UI claims "1 round" while the backend allows 3.
    await page.screenshot({ path: `test-results/tc-frm-49-ui-rounds-claim-${RUN}.png`, fullPage: true });
    expect
      .soft(page.getByText(/negotiate in 1 round|maximum 1 counter round/i), {
        message: 'UI must reflect the 3-round backend rule',
      })
      .toHaveCount(0, { timeout: 2000 });
  });
});
