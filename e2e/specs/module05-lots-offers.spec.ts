/**
 * Module 5 — Sell Produce: Lots & Buyer Leads (manual_test/01_farmer.md lines 653-835)
 * TC-FRM-38 … TC-FRM-49. CORE P0 module.
 *
 * The trading model is direct-connect (lead-gen): the buyer taps "Contact
 * Farmer", accepts the terms (+ MPIN step-up), and both parties' contacts are
 * revealed — they close the deal off-platform and the farmer marks it sold.
 *
 * Every test is self-contained: it creates the lots/buyers it needs through
 * the same APIs the UI calls, so no test depends on module state left behind
 * by another test.
 */
import { test, expect, type Page, type Locator } from '../fixtures/auth';
import { api, loginWithMpin, type Session } from '../fixtures/api';
import { API_BASE, FARMER, freshPhone } from '../test-data';

const RUN = Date.now().toString().slice(-7);

const ACCESS_KEY = 'agrovercity_access_token';
const REFRESH_KEY = 'agrovercity_refresh_token';
const PERSONA_KEY = 'agrovercity_active_persona';
const USER_KEY = 'agrovercity_user';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** [ADMIN] lot moderation. */
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

/** Register a throwaway vyapari-style buyer via the public onboard API, then
 *  MPIN-login so the returned session is shaped exactly like a normal app
 *  login (the web auth store rejects raw onboard sessions). */
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
      const session = await loginWithMpin(phone, '4321');
      return { ...session, phone };
    }
  }
  throw new Error(`createBuyer(${name}) failed after 3 attempts`);
}

async function createLead(buyer: Session, lotId: string, extras: Record<string, unknown> = {}): Promise<any> {
  const { status, body } = await api.post(
    '/leads',
    { lotId, termsAccepted: true, ...extras },
    buyer.accessToken,
  );
  return { status, body };
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

/** Open the notification bell panel (accessible name is the unread count badge,
 *  so target the title attribute). */
const openBell = async (page: Page): Promise<Locator> => {
  await page.locator('button[title="Notifications"]').first().click();
  const panel = page.locator('div.fixed.inset-0.z-50', { has: page.getByRole('heading', { name: 'Notifications' }) });
  await expect(panel.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  return panel;
};

test.describe('Module 5 — Sell Produce: Lots & Buyer Leads (TC-FRM-38…49)', () => {
  test('TC-FRM-38: post onion lot — open & live, buyer sees first name + village only', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const variety = `Nashik Red UAT${RUN}`;
    await page.goto('/farmer/lots');

    // Step 1: modal opens, crop field is a typeahead fed by the live crop catalog.
    const modal = await openLotModal(page);
    const cropInput = modalField(modal, 'Crop');
    const cropOptions = modal.locator('#lot-crop-options option');
    // Option text shows the vernacular name — assert on the option values instead.
    await expect
      .poll(async () => cropOptions.evaluateAll((els) => els.map((e) => e.getAttribute('value'))))
      .toEqual(expect.arrayContaining(['Soybean', 'Wheat', 'Cotton', 'Onion', 'Grapes']));

    // Step 2: fill data — posting goes live directly (no review step).
    await cropInput.fill('Onion');
    await modalField(modal, 'Variety').fill(variety);
    await modalField(modal, 'Quantity (q)').fill(String(FARMER.lotOnion.quantityQ));
    await modalField(modal, 'Quality Grade').selectOption(FARMER.lotOnion.grade);
    await modalField(modal, 'Expected Price (₹/q)').fill(String(FARMER.lotOnion.expectedRate));
    await modalField(modal, 'Village / Taluka').fill(FARMER.lotOnion.village);
    await modalField(modal, 'Harvest Date').fill(FARMER.lotOnion.harvestDate);
    await modalField(modal, 'Pickup Location / Gate').fill(FARMER.lotOnion.pickup);
    // The form takes a real photo upload (no raw URL field anymore).
    await expect(modal.getByRole('button', { name: /upload photo/i })).toBeVisible();
    const postBtn = modal.getByRole('button', { name: 'Post Produce Lot' });
    await expect(postBtn).toBeVisible();

    // Step 3: post → status open, appears in My Lots.
    await postBtn.click();
    await expect(page.getByText(/Produce lot posted/)).toBeVisible();
    const card = lotCard(page, variety);
    await expect(card.getByRole('heading', { name: /onion/i })).toBeVisible();
    await expect(card.getByText('open', { exact: true })).toBeVisible();
    await expect(card.getByText('0 Buyer Leads')).toBeVisible();

    // API truth: lot created with status "open".
    const lots = (await api.get('/market/lots', farmerApi.accessToken)).body.data;
    const mine = lots.find((l: any) => l.variety === variety);
    expect(mine).toBeTruthy();
    expect(mine.status).toBe('open');

    // Step 4 (Tester B browse): lot visible; farmer shown as first name + village only.
    const buyer = await createBuyer(`Kishor UAT${RUN}`);
    const browse = (await api.get('/market/lots/browse', buyer.accessToken, { crop: 'Onion' })).body.data;
    const seen = browse.find((l: any) => l.id === mine.id);
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
    const variety = `Thompson Seedless UAT${RUN}`;
    await page.goto('/farmer/lots');

    const modal = await openLotModal(page);
    await expect(modal.getByRole('button', { name: 'Post Produce Lot' })).toBeVisible();
    await expect
      .poll(async () =>
        modal.locator('#lot-crop-options option').evaluateAll((els) => els.map((e) => e.getAttribute('value'))),
      )
      .toContain('Grapes');
    await page.keyboard.press('Escape');

    const lot = await createLot(farmerApi, {
      crop: FARMER.lotGrapes.crop,
      variety,
      qty: FARMER.lotGrapes.quantityQ,
      rate: FARMER.lotGrapes.expectedRate,
      submitForReview: true,
    });
    expect(lot.status).toBe('pending_review');

    await page.reload();
    const card = lotCard(page, variety);
    await expect(card.getByText('pending review', { exact: true })).toBeVisible();

    const mod = await moderateLot(adminApi, lot.id, 'approve');
    expect(mod.status).toBe(200);
    await page.reload();
    await expect(card.getByText('open', { exact: true })).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('open');

    const panel = await openBell(page);
    await expect(panel.getByText('Lot review update').first()).toBeVisible();
  });

  test('TC-FRM-40: lot form validation — empty form, qty −5, price −10, nothing partial created', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const before = (await api.get('/market/lots', farmerApi.accessToken)).body.total;

    await page.goto('/farmer/lots');
    const modal = await openLotModal(page);

    // Step 1: empty form (clear the required Variety + Pickup fields) → HTML5 required errors.
    await modalField(modal, 'Variety').fill('');
    await modalField(modal, 'Pickup Location / Gate').fill('');
    await modal.getByRole('button', { name: 'Post Produce Lot' }).click();
    await expect(modal.locator('input:invalid')).not.toHaveCount(0);
    await expect(modal.getByRole('heading', { name: 'Post New Produce Lot' })).toBeVisible();

    // Step 2: quantity −5 → API 422 VALIDATION_ERROR (no HTML5 min gate — the
    // backend is the source of truth and the banner surfaces its message).
    await modalField(modal, 'Crop').fill('Onion');
    await modalField(modal, 'Variety').fill(`BadQty UAT${RUN}`);
    await modalField(modal, 'Pickup Location / Gate').fill(FARMER.lotOnion.pickup);
    await modalField(modal, 'Quantity (q)').fill('-5');
    await modalField(modal, 'Expected Price (₹/q)').fill('1450');
    await modal.getByRole('button', { name: 'Post Produce Lot' }).click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'invalid lot' })).toBeVisible();

    // Step 3: price −10 → error.
    await modalField(modal, 'Quantity (q)').fill('20');
    await modalField(modal, 'Expected Price (₹/q)').fill('-10');
    await modal.getByRole('button', { name: 'Post Produce Lot' }).click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: 'invalid lot' })).toBeVisible();

    // Step 4: photo is a file-upload control, not a URL text field.
    await expect(modal.getByRole('button', { name: /upload photo/i })).toBeVisible();
    await expect(modal.locator('input[type=file]')).toHaveCount(1);
    await expect(modal.locator('label:text-is("Produce Sample Photo URL")')).toHaveCount(0);

    // Step 5: no broken/partial lot was created by the failed attempts.
    const after = (await api.get('/market/lots', farmerApi.accessToken)).body.total;
    expect(after).toBe(before);
  });

  test('TC-FRM-41: edit lot — expected rate → ₹1,500/q, quantity → 25 q', async ({ farmerPage, farmerApi }) => {
    const page = farmerPage;
    const variety = `Edit UAT${RUN}`;
    const lot = await createLot(farmerApi, { crop: 'Onion', variety, qty: 20, rate: 1450 });

    await page.goto('/farmer/lots');
    const card = lotCard(page, variety);
    await expect(card.getByText('open', { exact: true })).toBeVisible();

    await card.getByTitle('Edit lot').click();
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Edit Produce Lot' }),
    });
    await expect(modal.getByRole('heading', { name: 'Edit Produce Lot' })).toBeVisible();
    await expect(modalField(modal, 'Variety')).toHaveValue(variety);
    await expect(modalField(modal, 'Quantity (q)')).toHaveValue('20');
    await expect(modalField(modal, 'Expected Price (₹/q)')).toHaveValue('1450');

    await modalField(modal, 'Expected Price (₹/q)').fill('1500');
    await modalField(modal, 'Quantity (q)').fill('25');
    await modal.getByRole('button', { name: 'Save Lot Changes' }).click();
    await expect(page.getByText(new RegExp(`Lot #${lot.id} updated\\.`))).toBeVisible();
    await expect(card.getByText('25 Quintals (2,500 kg)')).toBeVisible();
    await expect(card.getByText('₹1,500')).toBeVisible();

    const updated = await getLot(farmerApi, lot.id);
    expect(updated.expectedRate).toBe(1500);
    expect(updated.quantityQuintals).toBe(25);
  });

  test('TC-FRM-42: withdraw a lot — status withdrawn, hidden from buyers', async ({ farmerPage, farmerApi }) => {
    const page = farmerPage;
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Withdraw UAT${RUN}`,
      qty: 15,
      rate: 1400,
    });
    await page.goto('/farmer/lots');
    const card = lotCard(page, lot.variety);
    await expect(card.getByText('open', { exact: true })).toBeVisible();

    await card.getByTitle('Withdraw lot').click();
    await expect(page.getByText('Lot withdrawn from the marketplace.')).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('withdrawn');
    await page.reload();
    await expect(lotCard(page, lot.variety)).toHaveCount(0);

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
    const lot = await createLot(farmerApi, {
      crop: 'Onion',
      variety: `Moderated UAT${RUN}`,
      qty: 12,
      rate: 1600,
      submitForReview: true,
    });
    const rej = await moderateLot(adminApi, lot.id, 'reject', 'Photo unclear');
    expect(rej.status).toBe(200);

    await page.goto('/farmer/lots');
    const card = lotCard(page, lot.variety);
    await expect(card.getByText('rejected', { exact: true })).toBeVisible();
    await expect(card.getByText('Photo unclear')).toBeVisible();

    await card.getByTitle('Edit lot').click();
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Edit Produce Lot' }),
    });
    await modal.getByRole('button', { name: 'Save Lot Changes' }).click();
    await expect(page.getByText(new RegExp(`Lot #${lot.id} updated\\.`))).toBeVisible();
    await card.getByRole('button', { name: 'Submit Review' }).click();
    await expect(card.getByText('pending review', { exact: true })).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('pending_review');

    const appr = await moderateLot(adminApi, lot.id, 'approve');
    expect(appr.status).toBe(200);
    await page.reload();
    await expect(card.getByText('open', { exact: true })).toBeVisible();
  });

  test('TC-FRM-44: lead creation — terms gate, contact reveal both ways, idempotent repeat', async ({
    farmerApi,
  }) => {
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `Lead UAT${RUN}`, qty: 20, rate: 1500 });
    const kishor = await createBuyer(`Kishor UAT${RUN}`);

    // Terms gate: without acceptance the API refuses.
    const noTerms = await createLead(kishor, lot.id, { termsAccepted: false });
    expect(noTerms.status).toBe(422);
    expect(noTerms.body?.error?.code ?? noTerms.body?.code).toBe('TERMS_REQUIRED');

    // Own lot is forbidden.
    const own = await createLead(farmerApi, lot.id);
    expect(own.status).toBe(403);
    expect(own.body?.error?.code ?? own.body?.code).toBe('OWN_LOT');

    // Accept terms (+ MPIN — the onboarded buyer has one on file) → contact
    // revealed to the buyer AND the farmer (lead snapshot).
    const created = await createLead(kishor, lot.id, { mpin: '4321' });
    expect(created.status).toBe(201);
    const lead = created.body.lead;
    const chatRoomId: string = created.body.chatRoomId;
    expect(lead.status).toBe('new');
    expect(lead.lotId).toBe(lot.id);
    expect(lead.farmerContact.name).toBe('Ramesh');
    expect(lead.farmerContact.phone).toBe(FARMER.phone);
    // No WhatsApp on file → falls back to the account phone digits.
    expect(lead.farmerContact.whatsappDigits).toBe(`91${FARMER.phoneLocal}`);
    expect(lead.buyerContact.name).toBe('Kishor');
    // Onboard may normalize the phone to +91 — compare the trailing digits.
    expect(lead.buyerContact.phoneDigits.endsWith(kishor.phone.slice(-5))).toBe(true);
    expect(chatRoomId).toMatch(/^dm_/);

    // Repeat contact on the same lot is idempotent — same lead, no duplicate.
    const again = await createLead(kishor, lot.id, { mpin: '4321' });
    expect(again.status).toBe(200);
    expect(again.body.lead.id).toBe(lead.id);

    // Farmer inbox + buyer history.
    const inbox = (await api.get('/leads/mine', farmerApi.accessToken)).body.data;
    const mine = inbox.find((l: any) => l.id === lead.id);
    expect(mine).toBeTruthy();
    expect(mine.buyerContact.fullName).toContain('Kishor');
    const sent = (await api.get('/leads/mine?filter=sent', kishor.accessToken)).body.data;
    expect(sent.some((l: any) => l.id === lead.id && l.farmerContact.phone === FARMER.phone)).toBe(true);

    // Lot stays open while the lead is pending — deal happens off-platform.
    expect((await getLot(farmerApi, lot.id)).status).toBe('open');
  });

  test('TC-FRM-45: MPIN gate — missing/wrong MPIN rejected, correct MPIN unlocks', async ({ farmerApi }) => {
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `Mpin UAT${RUN}`, qty: 20, rate: 1500 });
    const mahesh = await createBuyer(`Mahesh UAT${RUN}`);

    const missing = await createLead(mahesh, lot.id);
    expect(missing.status).toBe(401);
    expect(missing.body?.error?.code ?? missing.body?.code).toBe('WRONG_MPIN');

    const wrong = await createLead(mahesh, lot.id, { mpin: '0000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body?.error?.code ?? wrong.body?.code).toBe('WRONG_MPIN');

    const ok = await createLead(mahesh, lot.id, { mpin: '4321' });
    expect(ok.status).toBe(201);
    expect(ok.body.lead.farmerContact.phone).toBe(FARMER.phone);
  });

  test('TC-FRM-46: buyer UI — Contact Farmer → terms popup → wrong MPIN → correct MPIN → contact card', async ({
    farmerApi,
    vyapariPage,
  }) => {
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `UiContact UAT${RUN}`, qty: 18, rate: 1490 });
    const { page } = vyapariPage;
    await page.goto('/seller/lots');

    const card = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: /^Onion$/ }) })
      .filter({ hasText: lot.variety });
    await card.getByRole('button', { name: 'Contact Farmer' }).click();

    // Terms popup gates the reveal.
    const modal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Agrovercity Terms — Connect Directly' }),
    });
    await expect(modal.getByText(/not accountable for any loss/i)).toBeVisible();
    const acceptBtn = modal.getByRole('button', { name: 'Accept & Show Contact' });
    await expect(acceptBtn).toBeDisabled(); // disabled until terms accepted
    await modal.getByRole('checkbox').check();
    await modal.getByPlaceholder('4-digit MPIN').fill('9999');
    await acceptBtn.click();
    await expect(page.locator('div.text-rose-800').filter({ hasText: /incorrect mpin/i })).toBeVisible();

    await modal.getByPlaceholder('4-digit MPIN').fill('4321');
    await acceptBtn.click();

    // Contact card: farmer first name, village, phone; WhatsApp + Call + Chat.
    const contactCard = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Farmer Contact Unlocked' }),
    });
    await expect(contactCard.getByRole('heading', { name: 'Farmer Contact Unlocked' })).toBeVisible();
    await expect(contactCard.getByText('Ramesh', { exact: true })).toBeVisible();
    await expect(contactCard.getByText(FARMER.phone)).toBeVisible();
    await expect(contactCard.getByText(new RegExp(FARMER.village))).toBeVisible();
    await expect(contactCard.locator('a[href^="https://wa.me/"]')).toBeVisible();
    await expect(contactCard.locator('a[href^="tel:"]')).toBeVisible();
    await page.keyboard.press('Escape');

    // Card now offers "View Contact Again" (lead already unlocked).
    await expect(card.getByRole('button', { name: 'View Contact Again' })).toBeVisible();
  });

  test('TC-FRM-47: farmer UI — lead in inbox, chat with buyer, mark contacted then sold', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `UiLead UAT${RUN}`, qty: 22, rate: 1510 });
    const kishor = await createBuyer(`UiLeadBuyer UAT${RUN}`);
    const { body } = await createLead(kishor, lot.id, { mpin: '4321' });
    const lead = body.lead;
    const chatRoomId: string = body.chatRoomId;

    await page.goto('/farmer/lots');

    // Lead inbox shows the buyer with contact channels.
    await expect(page.getByRole('heading', { name: /Buyer Leads \(/ })).toBeVisible();
    const leadRow = page.locator('div.rounded-3xl', { hasText: `UiLeadBuyer UAT${RUN}` });
    await expect(leadRow.getByText(/Interested in:.*Onion/, { exact: false })).toBeVisible();
    await expect(leadRow.getByText(new RegExp(kishor.phone))).toBeVisible();
    await expect(leadRow.locator('a[href^="https://wa.me/"]')).toBeVisible();

    // Bell: lead notification for the farmer. Close via the panel's X (the
    // overlay has no Escape handling and would block the next click).
    const panel = await openBell(page);
    await expect(panel.getByText('New lead / नया लीड').first()).toBeVisible();
    await panel.locator('button').last().click();

    // Chat with the buyer straight from the lead card.
    await leadRow.getByTitle('Chat with buyer').click();
    await expect(page).toHaveURL(/\/chat\?room=dm_/);
    await page.getByPlaceholder('Type a message…').fill('UAT: namaste, kal pickup possible?');
    await page.getByPlaceholder('Type a message…').press('Enter');
    await expect(page.getByText('UAT: namaste, kal pickup possible?')).toBeVisible();
    const msgs = (await api.get(`/chat/rooms/${chatRoomId}/messages`, kishor.accessToken)).body.data;
    expect(msgs.some((m: any) => (m.text || '').includes('namaste, kal pickup'))).toBe(true);

    // Farmer progresses the lead: contacted → sold (with final rate).
    await page.goto('/farmer/lots');
    const row = page.locator('div.rounded-3xl', { hasText: `UiLeadBuyer UAT${RUN}` });
    await row.getByRole('button', { name: 'Mark Contacted' }).click();
    await expect(row.getByText('contacted', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Mark Sold' }).click();
    const soldModal = page.locator('div.fixed.inset-0.z-50', {
      has: page.getByRole('heading', { name: 'Record the Deal' }),
    });
    await expect(soldModal).toBeVisible();
    await soldModal.locator('input[type=number]').fill('1520');
    await soldModal.getByRole('button', { name: 'Confirm — Deal Done' }).click();

    await expect(page.getByText(/Deal with UiLeadBuyer recorded/)).toBeVisible();
    await expect(row.getByText('Deal Done')).toBeVisible();
    await expect(lotCard(page, lot.variety).getByText('sold', { exact: true })).toBeVisible();
    expect((await getLot(farmerApi, lot.id)).status).toBe('sold');
    expect((await getLot(farmerApi, lot.id)).finalRate).toBe(1520);

    // Buyer is told the lot is sold.
    const notifs = (await api.get('/notifications', kishor.accessToken)).body.data;
    expect(notifs.some((n: any) => n.type === 'lead_marked_sold')).toBe(true);
  });

  test('TC-FRM-48: lead status filters — sold tab keeps history', async ({ farmerPage, farmerApi }) => {
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `Filter UAT${RUN}`, qty: 10, rate: 1400 });
    const buyer = await createBuyer(`FilterBuyer UAT${RUN}`);
    const { body } = await createLead(buyer, lot.id, { mpin: '4321' });
    const upd = await api.patch(`/leads/${body.lead.id}`, { status: 'sold', finalRate: 1480 }, farmerApi.accessToken);
    expect(upd.status).toBe(200);

    const page = farmerPage;
    await page.goto('/farmer/lots');
    // Default filter shows everything; sold tab shows the closed deal.
    await page.getByRole('button', { name: 'sold', exact: true }).click();
    const soldRow = page.locator('div.rounded-3xl', { hasText: `FilterBuyer UAT${RUN}` });
    await expect(soldRow.getByText('Closed at ₹1,480/q')).toBeVisible();
    await expect(soldRow.getByText('Deal Done')).toBeVisible();
    // New tab no longer lists this buyer's lead (other tests' leads may remain).
    await page.getByRole('button', { name: 'new', exact: true }).click();
    await expect(page.locator('div.rounded-3xl', { hasText: `FilterBuyer UAT${RUN}` })).toHaveCount(0);
  });

  test('TC-FRM-49: sold-lot protections — edit/withdraw blocked, relist blocked (LOT_ALREADY_SOLD)', async ({
    farmerPage,
    farmerApi,
  }) => {
    const page = farmerPage;
    const lot = await createLot(farmerApi, { crop: 'Onion', variety: `SoldProt UAT${RUN}`, qty: 20, rate: 1500 });
    const ms = await api.post(`/market/lots/${lot.id}/mark-sold`, { finalRate: 1500 }, farmerApi.accessToken);
    expect(ms.status).toBe(200);

    await page.goto('/farmer/lots');
    const card = lotCard(page, lot.variety);
    await expect(card.getByText('sold', { exact: true })).toBeVisible();
    await expect(card.getByText('Closed at ₹1,500/q')).toBeVisible();

    // Sold lots carry no edit/withdraw controls in the UI.
    await expect(card.getByTitle('Edit lot')).toHaveCount(0);
    await expect(card.getByTitle('Withdraw lot')).toHaveCount(0);

    // The API still guards: update → 409 LOT_NOT_EDITABLE.
    const upd = await api.put(
      `/market/lots/${lot.id}`,
      {
        crop: 'Onion',
        variety: lot.variety,
        quantityQuintal: 20,
        grade: 'A',
        expectedPricePerQuintal: 1500,
        location: FARMER.lotOnion.pickup,
        village: FARMER.village,
      },
      farmerApi.accessToken,
    );
    expect(upd.status).toBe(409);
    expect(upd.body?.error?.code ?? upd.body?.code).toBe('LOT_NOT_EDITABLE');

    // Withdraw → 409; relist → LOT_ALREADY_SOLD; mark-sold idempotent.
    const del = await api.del(`/market/lots/${lot.id}`, farmerApi.accessToken);
    expect(del.status).toBe(409);
    const relist = await api.post(`/market/lots/${lot.id}/relist`, { priority: true }, farmerApi.accessToken);
    expect(relist.status).toBe(409);
    expect(relist.body?.error?.code ?? relist.body?.code).toBe('LOT_ALREADY_SOLD');
    const again = await api.post(`/market/lots/${lot.id}/mark-sold`, { finalRate: 1500 }, farmerApi.accessToken);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('sold');
  });
});
