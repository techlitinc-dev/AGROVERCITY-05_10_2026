/**
 * Module 1c — Bank Accounts / Profile / Land Records / Vault / Consent
 * TC-FRM-08: Add a bank account (first = auto-primary)      [manual L180-192]
 * TC-FRM-09: Verify (penny-drop), set primary, delete & re-promote [L194-207]
 * TC-FRM-10: Bank form validation (negative)                [L209-222]
 * TC-FRM-11: Edit profile farm details                      [L224-237]
 * TC-FRM-12: Search, import and download 7/12 land record   [L239-254]
 * TC-FRM-13: Upload vault documents                         [L256-270]
 * TC-FRM-14: Role switcher and data-sharing consent         [L272-285]
 *
 * Defects discovered while deriving selectors (kept as failing assertions,
 * see run artifacts):
 *  D1 BankAccountsView sends `accountHolderName` but the API requires
 *     `accountHolder` → UI "Add Account" always fails with a generic
 *     "request validation failed" banner (TC-FRM-08).
 *  D2 The view reads `maskedAccountNumber`/`accountHolderName`/`status`
 *     while the API returns `accountNumberMasked`/`accountHolder`/
 *     `verifyStatus` → card shows "A/c ••••", "Holder: —" and the status
 *     badge stays "Pending" even after penny-drop verification succeeds
 *     (TC-FRM-09 step 1 verified-badge check fails by design).
 *  D3 LandRecordsView expects `surveyNumber/subDivision/totalAreaHa/
 *     cropsRegistered/...` but the API returns `gatNumber/khataNumber/
 *     totalAreaHectares/cropHistory/...` → "Gat No. undefined (Hissa
 *     undefined)" and a render crash on `cropsRegistered.join` (TC-FRM-12).
 *  D4 VaultView uploads the file via POST /uploads but then registers the
 *     document with a JSON POST /vault/documents; the endpoint only accepts
 *     multipart form (file + docType enum aadhaar|712|bankPassbook|
 *     soilHealthCard|other) → UI upload always fails (TC-FRM-13 steps 2-3).
 */
import { test, expect, FARMER } from '../fixtures/auth';
import { api } from '../fixtures/api';
import { API_BASE } from '../test-data';

const THROWAWAY_BANK = 'HDFC Bank';
const THROWAWAY_IFSC = 'HDFC0001234';

/** Unique 12-digit account number for the throwaway second account. */
function throwawayAccountNo(): string {
  return `50100${Date.now().toString().slice(-7)}`;
}

/** Minimal single-page PDF (valid enough for the storage layer). */
function tinyPdfBuffer(title: string): Buffer {
  const text = `${title} - UAT upload`;
  const stream = `BT /F1 12 Tf 40 760 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test.describe('Module 1c — Bank/Profile/Land/Vault/Consent', () => {
  // ---------------------------------------------------------------------
  // TC-FRM-08: Add a bank account (first = auto-primary)
  // ---------------------------------------------------------------------
  test('TC-FRM-08: add SBI bank account via Bank Accounts UI', async ({ farmerPage: page, farmerApi }) => {
    await page.goto('/farmer/bank-accounts');
    const sbiHeading = page.getByRole('heading', { name: FARMER.bank.name });
    await expect(sbiHeading.first()).toBeVisible(); // existing list loaded

    // Step 1: Profile → Bank Accounts → Add Bank Account → form opens with
    // Account Holder Name, Bank Name, Account Number, IFSC.
    await page.getByRole('button', { name: 'Add Bank Account' }).click();
    const modal = page.locator('div.max-w-sm');
    await expect(modal.getByRole('heading', { name: 'Add Bank Account' })).toBeVisible();
    await expect(modal.getByLabel('Account Holder Name')).toBeVisible();
    await expect(modal.getByLabel('Bank Name')).toBeVisible();
    await expect(modal.getByLabel('Account Number')).toBeVisible();
    await expect(modal.getByLabel('IFSC')).toBeVisible();

    // Step 2: fill with the test data → Save. Expected: account saved,
    // verifyStatus "unverified", number masked XXXX…5678.
    const before = (await api.get('/bank-accounts', farmerApi.accessToken)).body.data.length;
    await modal.getByLabel('Account Holder Name').fill(FARMER.bank.holder);
    await modal.getByLabel('Bank Name').fill(FARMER.bank.name);
    await modal.getByLabel('Account Number').fill(FARMER.bank.account);
    await modal.getByLabel('IFSC').fill(FARMER.bank.ifsc);
    await page.getByRole('button', { name: 'Add Account', exact: true }).click();

    // Manual expectation: "Bank account added. Verify it to receive settlements."
    // DEFECT D1: the view posts `accountHolderName`, the API requires
    // `accountHolder`, so a generic "request validation failed" banner shows
    // and nothing is saved. This assertion is kept on purpose.
    await expect(page.getByText(/bank account added\. verify it to receive settlements/i)).toBeVisible();

    const after = (await api.get('/bank-accounts', farmerApi.accessToken)).body.data.length;
    expect(after).toBe(before + 1);
    const added = (await api.get('/bank-accounts', farmerApi.accessToken)).body.data.find(
      (a: any) => a.bankName === FARMER.bank.name && a.accountNumberMasked?.endsWith('5678')
    );
    expect(added).toBeTruthy();

    // Step 3: first account gets the Primary badge automatically.
    const card = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: FARMER.bank.name }) }).first();
    await expect(card.getByText('Primary')).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TC-FRM-09: Verify (penny-drop), set primary, delete & re-promote
  // ---------------------------------------------------------------------
  test('TC-FRM-09: penny-drop verify, set primary on second account, delete & re-promote', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    // --- Setup (API): the UI "Add" is broken (defect D1), so the second
    // throwaway account is created through the same API the UI calls.
    const token = farmerApi.accessToken;
    let list = (await api.get('/bank-accounts', token)).body.data as any[];
    if (!list.some((a) => a.bankName === FARMER.bank.name)) {
      const created = await api.post(
        '/bank-accounts',
        {
          bankName: FARMER.bank.name,
          accountNumber: FARMER.bank.account,
          ifsc: FARMER.bank.ifsc,
          accountHolder: FARMER.bank.holder,
        },
        token
      );
      expect(created.status).toBe(200);
    }
    // Clean up leftovers from an interrupted previous run (never the primary).
    list = (await api.get('/bank-accounts', token)).body.data as any[];
    for (const acc of list.filter((a) => a.bankName === THROWAWAY_BANK && !a.isPrimary)) {
      await api.del(`/bank-accounts/${acc.id}`, token);
    }
    const throwawayNo = throwawayAccountNo();
    const add2 = await api.post(
      '/bank-accounts',
      { bankName: THROWAWAY_BANK, accountNumber: throwawayNo, ifsc: THROWAWAY_IFSC, accountHolder: FARMER.name },
      token
    );
    expect(add2.status).toBe(200);
    expect(add2.body.verifyStatus).toBe('unverified');
    expect(add2.body.isPrimary).toBe(false);

    await page.goto('/farmer/bank-accounts');
    const sbiCard = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: FARMER.bank.name }) }).first();
    const hdfcCard = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: THROWAWAY_BANK }) }).first();
    await expect(sbiCard).toBeVisible();
    await expect(hdfcCard).toBeVisible();

    // Step 1: on the SBI account → tap Verify Account (penny-drop sandbox).
    await sbiCard.getByRole('button', { name: /verify account/i }).click();
    await expect(page.getByText(/account verification initiated/i)).toBeVisible();
    // Backend penny-drop really flips the status…
    await expect
      .poll(
        async () =>
          (await api.get('/bank-accounts', token)).body.data.find((a: any) => a.bankName === FARMER.bank.name)
            ?.verifyStatus,
        { timeout: 15_000 }
      )
      .toBe('verified');

    // Step 2: second account saved, NOT primary.
    await expect(hdfcCard.getByText('Primary')).toHaveCount(0);

    // Step 3: on the HDFC account → Set Primary → badge moves to HDFC.
    await hdfcCard.getByRole('button', { name: /set primary/i }).click();
    await expect(page.getByText(/primary settlement account updated/i)).toBeVisible();
    await expect(hdfcCard.getByText('Primary')).toBeVisible();
    await expect(sbiCard.getByText('Primary')).toHaveCount(0);

    // Step 4: delete HDFC → confirm → SBI auto-promoted to primary again.
    await hdfcCard.getByRole('button', { name: /^remove$/i }).click();
    await expect(page.getByText(/bank account removed/i)).toBeVisible();
    await expect(hdfcCard).toHaveCount(0);
    await expect(sbiCard.getByText('Primary')).toBeVisible();

    const finalList = (await api.get('/bank-accounts', token)).body.data as any[];
    expect(finalList.filter((a) => a.bankName === THROWAWAY_BANK)).toHaveLength(0);
    expect(finalList.find((a) => a.bankName === FARMER.bank.name)?.isPrimary).toBe(true);

    // Step 1 (UI expected result): after penny-drop the status becomes
    // "verified" on the card. DEFECT D2: the view reads `status` while the
    // API returns `verifyStatus`, so the badge keeps showing "Pending".
    // Asserted last so the remaining steps still get coverage.
    await page.reload();
    await expect(
      page
        .locator('div.rounded-3xl', { has: page.getByRole('heading', { name: FARMER.bank.name }) })
        .first()
        .getByText('Verified')
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TC-FRM-10: Bank form validation (negative)
  // ---------------------------------------------------------------------
  test('TC-FRM-10: bank form validation — empty fields, bad IFSC, non-digit account', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    const token = farmerApi.accessToken;
    const countAccounts = async () => (await api.get('/bank-accounts', token)).body.data.length as number;
    const baseCount = await countAccounts();

    // Step 1: Save with all fields empty → required-field enforcement; the
    // app implements this via a disabled Save button (no per-field error
    // messages are rendered — noted as a deviation from the manual).
    await page.goto('/farmer/bank-accounts');
    await page.getByRole('button', { name: 'Add Bank Account' }).click();
    const modal = page.locator('div.max-w-sm');
    await expect(modal.getByRole('heading', { name: 'Add Bank Account' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Add Account', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    expect(await countAccounts()).toBe(baseCount); // nothing saved

    // Step 2: IFSC "SBIN123" → format error, nothing saved.
    await page.getByRole('button', { name: 'Add Bank Account' }).click();
    await modal.getByLabel('Account Holder Name').fill(FARMER.bank.holder);
    await modal.getByLabel('Bank Name').fill(FARMER.bank.name);
    await modal.getByLabel('Account Number').fill(FARMER.bank.account);
    await modal.getByLabel('IFSC').fill('SBIN123');
    await modal.getByRole('button', { name: 'Add Account', exact: true }).click();
    await expect(page.locator('div.text-rose-800').first()).toBeVisible(); // validation error banner
    expect(await countAccounts()).toBe(baseCount);
    await page.keyboard.press('Escape');

    // Step 3: Account Number "ABC123" → only digits are accepted (the input
    // strips letters client-side → "123"), and saving fails with an error.
    await page.getByRole('button', { name: 'Add Bank Account' }).click();
    const acctInput = modal.getByLabel('Account Number');
    await acctInput.fill('ABC123');
    await expect(acctInput).toHaveValue('123'); // non-digits rejected while typing
    await modal.getByLabel('Account Holder Name').fill(FARMER.bank.holder);
    await modal.getByLabel('Bank Name').fill(FARMER.bank.name);
    await modal.getByLabel('IFSC').fill(FARMER.bank.ifsc);
    await modal.getByRole('button', { name: 'Add Account', exact: true }).click();
    await expect(page.locator('div.text-rose-800').first()).toBeVisible(); // too short / invalid account
    expect(await countAccounts()).toBe(baseCount); // Step 4: list unchanged
  });

  // ---------------------------------------------------------------------
  // TC-FRM-11: Edit profile farm details
  // ---------------------------------------------------------------------
  test('TC-FRM-11: edit profile farm details — vernacular name, Drip, Grapes+Onion', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    // Step 1: Profile → Edit Profile → form opens with current values.
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    const section = page.locator('div.rounded-3xl', { has: page.getByText('Edit Profile', { exact: true }) }).first();
    await expect(section.getByLabel(/vernacular name/i)).toBeVisible();
    await expect(section.getByLabel('Irrigation type')).toBeVisible();

    // Steps 2-3: enter vernacular name, location, farm size 3 acres,
    // irrigationType "Drip", crops Grapes + Onion.
    await section.getByLabel(/vernacular name/i).fill(FARMER.vernacularName);
    await section.getByLabel('Village').fill(FARMER.village);
    await section.getByLabel('District').fill(FARMER.district);
    await section.getByLabel('State').fill(FARMER.state);
    await section.getByLabel(/land area \(acres\)/i).fill(String(FARMER.farmSizeAcres));
    await section.getByLabel('Irrigation type').selectOption('Drip');
    await section.getByLabel(/active crops/i).fill('Grapes, Onion');
    await section.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible();
    // Profile shows both names.
    await expect(page.getByText(FARMER.vernacularName).first()).toBeVisible();

    // Step 4: Save → reopen profile → changes persisted.
    await page.reload();
    const reopened = page.locator('div.rounded-3xl', { has: page.getByText('Edit Profile', { exact: true }) }).first();
    await expect(reopened.getByLabel(/vernacular name/i)).toHaveValue(FARMER.vernacularName);
    await expect(reopened.getByLabel('Irrigation type')).toHaveValue('Drip');
    await expect(reopened.getByLabel(/land area \(acres\)/i)).toHaveValue(String(FARMER.farmSizeAcres));
    const cropsValue = await reopened.getByLabel(/active crops/i).inputValue();
    expect(cropsValue).toContain('Grapes');
    expect(cropsValue).toContain('Onion');

    // Same truth via the API the UI uses.
    const me = (await api.get('/users/me', farmerApi.accessToken)).body;
    expect(me.vernacularName).toBe(FARMER.vernacularName);
    expect(me.irrigationType).toBe('Drip');
    expect(me.landAreaAcres).toBe(FARMER.farmSizeAcres);
    expect(me.activeCrops).toEqual(expect.arrayContaining(['Grapes', 'Onion']));
    expect(me.district).toBe(FARMER.district);
    expect(me.village).toBe(FARMER.village);

    // Home greeting/location reflect them.
    await page.goto('/farmer');
    await expect(page.getByRole('main').getByText(/pimpalgaon baswant, nashik/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TC-FRM-12: Search, import and download 7/12 land record
  // ---------------------------------------------------------------------
  test('TC-FRM-12: search 7/12 by district Nashik + Gat 312, import, download PDF', async ({ farmerPage: page }) => {
    await page.goto('/farmer/712');

    // Step 1: enter District "Nashik", Gat/Survey No. "312" → Search Digital
    // Record. Expected: record card "Gat No. 312 (Hissa 2)" with owner, area.
    // DEFECT D3: the API returns gatNumber/khataNumber/totalAreaHectares but
    // the view renders surveyNumber/subDivision/totalAreaHa and crashes on
    // cropsRegistered.join → "Gat No. undefined (Hissa undefined)" / blank.
    // This assertion is kept on purpose.
    const districtInput = page.getByPlaceholder(/district/i);
    await districtInput.fill(FARMER.district);
    await page.getByRole('button', { name: /search digital record/i }).click();
    const card = page.locator('div.rounded-3xl', { hasText: 'Registered Owner' }).first();
    await expect(card.getByText(/gat no\. 312/i)).toBeVisible();
    await expect(card.getByText(/hissa 2/i)).toBeVisible();
    await expect(card.getByText(/registered owner/i)).toBeVisible();
    await expect(card.getByText(/total area/i)).toBeVisible();

    // Step 3: Import into Agrovercity profile → confirm → success message.
    await card.getByRole('button', { name: /import to profile/i }).click();
    await expect(page.getByText(/gat 312 imported into your agrovercity profile/i)).toBeVisible();

    // Step 4: Download 7/12 PDF.
    const downloadPromise = page.waitForEvent('download');
    await card.getByRole('button', { name: '7/12 PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/7-12-gat-312\.pdf$/);

    // Step 5: map view → plot polygon/marker renders.
    await card.getByRole('button', { name: /cadastral map/i }).click();
    await expect(page.getByText('Farm Parcel Boundary (Geofence Map)')).toBeVisible();
    await expect(page.locator('svg polygon').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // TC-FRM-13: Upload vault documents
  // ---------------------------------------------------------------------
  test('TC-FRM-13: vault upload flow with doc-type picker and 6 MB rejection', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    // Step 1: Open Vault → Upload Document → doc-type picker opens.
    await page.goto('/farmer/vault');
    await page.getByRole('button', { name: /upload document/i }).click();
    const modal = page.locator('div.max-w-sm');
    await expect(modal.getByRole('heading', { name: 'Upload to Vault' })).toBeVisible();
    const typeSelect = modal.getByLabel('Document Type');
    for (const label of [
      'Land Record (7/12)',
      'Identity (Aadhaar / PAN)',
      'Banking / DBT',
      'Agronomy (Soil Health Card)',
    ]) {
      await expect(typeSelect.locator('option', { hasText: label })).toBeAttached();
    }

    // Steps 2-3: upload a small 7/12 PDF tagged "Land Record (7/12)".
    // Expected: saved and listed with type + date.
    // DEFECT D4: the view registers the doc with a JSON POST, but
    // /vault/documents only accepts multipart (file + docType enum), so the
    // upload fails with a generic "request validation failed" banner and the
    // document is never listed. This assertion is kept on purpose.
    await typeSelect.selectOption({ label: 'Land Record (7/12)' });
    await modal.locator('input[type="file"]').setInputFiles({
      name: `uat-712-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: tinyPdfBuffer('7/12 Gat 312'),
    });
    await modal.getByRole('button', { name: /upload to vault/i }).click();
    await expect(page.getByText(/document uploaded to your encrypted vault/i)).toBeVisible();
    await expect(
      page.locator('div.rounded-3xl', { hasText: 'Land Record' }).getByText(/land record/i).first()
    ).toBeVisible();

    // Step 4 (API-level negative, per assignment): a 6 MB file is rejected
    // with the size error ("file must be ≤ 5 MB").
    const form = new FormData();
    form.append('files', new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'application/pdf' }), 'big6mb.pdf');
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerApi.accessToken}` },
      body: form,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body?.error?.message ?? '').toMatch(/exceeds 5 mb/i);
  });

  // ---------------------------------------------------------------------
  // TC-FRM-14: Role switcher and data-sharing consent
  // ---------------------------------------------------------------------
  test('TC-FRM-14: role switcher capsule on home header + consent toggle in settings', async ({
    farmerPage: page,
    farmerApi,
  }) => {
    // Steps 1-2: tap the role switcher capsule on the home header → sheet
    // opens listing profiles → select Farmer again → sheet closes, no crash.
    await page.goto('/farmer');
    const capsule = page.getByRole('button', { name: /farmer \/ kisan/i });
    await expect(capsule).toBeVisible();
    await capsule.click();
    // On the web build the "sheet" is the persona dropdown in the header.
    await expect(page.getByText('Switch Active Persona (15 Roles)')).toBeVisible();
    const farmerOption = page.getByRole('button', { name: /किसान/ });
    await expect(farmerOption).toBeVisible();
    await expect(farmerOption.getByText('Active')).toBeVisible();

    await farmerOption.click();
    await expect(page.getByText('Switch Active Persona (15 Roles)')).toHaveCount(0);
    await expect(page).toHaveURL(/\/farmer$/);
    await expect(page.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible(); // home unchanged

    // Steps 3-4: Profile → Settings → Consent / Data sharing → OFF, then ON.
    await page.goto('/settings');
    const consentsSection = page.locator('div.rounded-3xl', { has: page.getByText('Data Consents', { exact: true }) }).first();
    await expect(consentsSection).toBeVisible();
    const dataSharingRow = consentsSection.getByRole('button', { name: /data sharing/i });
    await expect(dataSharingRow).toBeVisible();

    await dataSharingRow.click(); // OFF
    await expect
      .poll(
        async () => (await api.get('/users/me/consents', farmerApi.accessToken)).body?.dataSharing,
        { timeout: 15_000 }
      )
      .toBe(false);

    await dataSharingRow.click(); // back ON — must end ON (TC-FRM-22 depends on it)
    await expect
      .poll(
        async () => (await api.get('/users/me/consents', farmerApi.accessToken)).body?.dataSharing,
        { timeout: 15_000 }
      )
      .toBe(true);
  });
});
