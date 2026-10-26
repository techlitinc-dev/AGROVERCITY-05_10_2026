/**
 * Module 1b — Account / Onboarding / KYC (manual_test/01_farmer.md lines 71-178)
 * TC-FRM-01: Register a new farmer account with OTP (real UI: /login → OTP →
 *            /register wizard → MPIN → farmer home; fresh phone every run).
 * TC-FRM-04: OTP rules — 30s resend lock (UI banner + API 409), old OTP
 *            invalidated after resend, one-shot consume, generic errors, and
 *            5-minute expiry (dev-assisted backdate of the throwaway session
 *            doc, exactly as the manual marks step 5 "Dev-assisted").
 * TC-FRM-05: Onboarding/home labels in हिन्दी via the header language button.
 * TC-FRM-06: Submit KYC through the real /kyc UI, [ADMIN] approves via API,
 *            verified badge + GET /kyc/status.
 * TC-FRM-07: KYC negatives (wrong doc matrix, 6MB file, .txt file) — API level.
 *
 * NOTE (shared-file bug, reported not fixed): fixtures/api.ts `adminApproveKyc`
 * does not work against the live backend — /admin/kyc/pending returns flat
 * per-DOCUMENT rows (docId/status/userId at top level, no nested `docs`), and
 * /admin/kyc/{docId}/verify requires the `X-Audit-Reason` HEADER (body `reason`
 * alone → 422). TC-FRM-06 therefore approves docs with the inline helper below,
 * using the shapes discovered from the OpenAPI spec / live probes.
 */
import { test, expect } from '../fixtures/auth';
import { api, requestOtp, verifyOtp } from '../fixtures/api';
import { FARMER, freshPhone } from '../test-data';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const execFileP = promisify(execFile);
// Playwright may be invoked from e2e/ or the repo root — resolve the backend dir either way.
const BACKEND_DIR = [path.resolve(process.cwd(), '../backend'), path.resolve(process.cwd(), 'backend')].find((p) =>
  existsSync(path.join(p, 'app'))
)!;
const PY = path.join(BACKEND_DIR, '.venv/bin/python');

/** 179-byte real JPEG accepted by the KYC upload endpoint (verified live). */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAj/wAARCAAIAAgDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AssAB/9k=';

const FIX_DIR = '/tmp/agrovercity-module01b';
const AADHAAR_JPG = path.join(FIX_DIR, 'aadhaar-front.jpg');
const PAN_JPG = path.join(FIX_DIR, 'pan-card.jpg');
const BANK_JPG = path.join(FIX_DIR, 'bank-proof.jpg');
const BIG_JPG = path.join(FIX_DIR, 'oversize-6mb.jpg');
const NOTE_TXT = path.join(FIX_DIR, 'not-a-doc.txt');

test.beforeAll(() => {
  mkdirSync(FIX_DIR, { recursive: true });
  writeFileSync(AADHAAR_JPG, Buffer.from(TINY_JPEG_B64, 'base64'));
  writeFileSync(PAN_JPG, Buffer.from(TINY_JPEG_B64, 'base64'));
  writeFileSync(BANK_JPG, Buffer.from(TINY_JPEG_B64, 'base64'));
  // 6 MB + 1 byte JPEG-looking payload (> 5 MB limit from manual TC-FRM-07)
  writeFileSync(BIG_JPG, Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(6 * 1024 * 1024, 7), Buffer.from([0xff, 0xd9])]));
  writeFileSync(NOTE_TXT, 'this is a text file, not a document image\n');
});

/** Dev-assisted: rewrite a field on a throwaway OTP session doc in Firestore. */
async function backdateOtpSession(sessionId: string, field: 'createdAt' | 'expiresAt', iso: string): Promise<void> {
  const script = `
import sys, asyncio
sys.path.insert(0, '.')
from app.core.db import get_db

async def main():
    db = get_db()
    ref = db.collection('otp_sessions').document(sys.argv[1])
    snap = await ref.get()
    if not snap.exists:
        raise SystemExit('otp session not found: ' + sys.argv[1])
    doc = snap.to_dict()
    doc[sys.argv[2]] = sys.argv[3]
    await ref.set(doc)

asyncio.run(main())
`;
  await execFileP(PY, ['-c', script, sessionId, field, iso], { cwd: BACKEND_DIR });
}

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString().replace('Z', '+00:00');

/** [ADMIN] Approve every pending KYC document of a user (live backend shapes:
 *  /admin/kyc/pending returns flat doc rows; verify needs X-Audit-Reason). */
async function adminVerifyAllKycDocs(adminToken: string, uid: string): Promise<number> {
  const { status, body } = await api.get('/admin/kyc/pending', adminToken);
  expect(status).toBe(200);
  const rows = Array.isArray(body) ? body : (body?.data ?? body?.items ?? []);
  let verified = 0;
  for (const row of rows) {
    if ((row.userId ?? row.uid) !== uid) continue;
    if (row.status !== 'pending' && row.status !== 'in_review') continue;
    const docId = row.docId ?? row.id;
    const res = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8000/v1'}/admin/kyc/${encodeURIComponent(docId)}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'X-Audit-Reason': 'UAT TC-FRM-06 auto-approve',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    verified += 1;
  }
  return verified;
}

/** Multipart KYC upload straight against the backend contract. */
async function uploadKycDoc(token: string, caseId: string, docId: string, filePath: string, mime: string, fname: string) {
  const form = new FormData();
  const buf = readFileSync(filePath);
  form.append('file', new Blob([buf], { type: mime }), fname);
  const res = await fetch(
    `${process.env.API_BASE_URL || 'http://localhost:8000/v1'}/kyc/cases/${caseId}/docs/${encodeURIComponent(docId)}/upload`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.describe('Module 1b — Account / Onboarding / KYC (TC-FRM-01/04/05/06/07)', () => {
  test('TC-FRM-01: register a new farmer account with OTP through the real UI', async ({ page }) => {
    const phone = freshPhone();
    await page.goto('/login');

    // Step 1-2 (manual): enter the fresh phone → Continue → OTP screen with dev auto-OTP banner.
    await page.locator('input[type="tel"]').fill(phone);
    await page.getByRole('button', { name: /continue|आगे/i }).click();
    const devBanner = page.locator('text=Dev Auto-OTP').first();
    await expect(devBanner).toBeVisible();
    await expect(page.getByText(/one-time first login verification/i)).toBeVisible();

    // Step 3: dev auto-fill banner drives the OTP into the field and verifies.
    await page.getByRole('button', { name: /auto-fill & verify/i }).click();
    await expect(page).toHaveURL(/\/register/);

    // Wizard step 1: Set MPIN (phone prefilled from the OTP step state).
    await expect(page.getByText(/create your 4-digit security mpin/i)).toBeVisible();
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toHaveValue(phone);
    const mpinInputs = page.locator('input[type="password"]');
    await mpinInputs.nth(0).fill(FARMER.mpin);
    await mpinInputs.nth(1).fill(FARMER.mpin);
    await expect(page.getByText(/pins match/i)).toBeVisible();
    await page.getByRole('button', { name: /next: select your role/i }).click();

    // Wizard step 2: persona — Farmer.
    await expect(page.getByText(/what is your primary role/i)).toBeVisible();
    await page.getByRole('button', { name: /kisan \/ farmer/i }).first().click();
    await page.getByRole('button', { name: /next: profile details/i }).click();

    // Wizard step 3: profile details (state/district/village defaults already match).
    await expect(page.getByText(/personal & regional details/i)).toBeVisible();
    await page.getByPlaceholder(/balaram kisan|ramesh patil/i).fill(FARMER.name);
    const stateSelect = page.locator('select').first();
    await expect(stateSelect).toHaveValue('Maharashtra');
    await expect(page.getByPlaceholder(/e\.g\. nashik/i)).toHaveValue(FARMER.district);
    await expect(page.getByPlaceholder(/e\.g\. chandwad/i)).toHaveValue(FARMER.village);
    // App language = English (manual step 1: language screen accepts English).
    const langSelect = page.locator('select').nth(1);
    await expect(langSelect).toHaveValue('en');
    // Farm size chips offered by the UI (manual: 3 acres — closest offered chip is 2.5; gap noted in report).
    await expect(page.getByRole('button', { name: /^1 acres$/i })).toBeVisible();
    await page.getByRole('button', { name: /^2\.5 acres$/i }).click();

    // Step 5: submit → account created, land on the farmer home with seeded demo data.
    await page.getByRole('button', { name: /launch workspace/i }).click();
    await expect(page).toHaveURL(/\/farmer/);
    await expect(page.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`${FARMER.village}, ${FARMER.district}`, 'i')).first()).toBeVisible();
    // Demo data seeded: Kisan Coins balance card + daily tasks list visible.
    const coinsCard = page.locator('a[href="/farmer/coins"]');
    await expect(coinsCard).toBeVisible();
    await expect(coinsCard.getByText(/^kisan coins$/i)).toBeVisible();
    await expect(coinsCard.getByText(/^\d+$/)).toBeVisible();

    // Step 6: kill & reopen (reload) — session persists, no crash, still on the farmer home.
    await page.reload();
    await expect(page).toHaveURL(/\/farmer/);
    await expect(page.getByRole('heading', { name: /ram ram, ramesh/i })).toBeVisible();
  });

  test('TC-FRM-04: OTP rules — resend lock, invalidated old OTP, one-shot consume, expiry', async ({ page }) => {
    // ---------- UI part (manual step 1): resend is locked with a ~30s message ----------
    const uiPhone = freshPhone();
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill(uiPhone);
    await page.getByRole('button', { name: /continue|आगे/i }).click();
    await expect(page.locator('text=Dev Auto-OTP').first()).toBeVisible();
    // The OTP step has no dedicated Resend control; the only resend affordance is
    // "Request OTP via SMS" on the phone step — it must surface the 30s lock.
    await page.getByRole('button', { name: /change mobile number/i }).click();
    await page.getByRole('button', { name: /request otp via sms/i }).click();
    await expect(page.getByText(/retry in \d+\s*s/i)).toBeVisible();

    // ---------- API part: backend OTP rules on throwaway phones ----------
    // Step 1+2: resend lock is 30s (RESEND_TOO_SOON) and a new OTP is issued once unlocked.
    const phone = freshPhone();
    const s1 = await requestOtp(phone);
    expect(s1.status).toBe(200);
    expect(s1.body.devOtp).toMatch(/^\d{6}$/);
    expect(s1.body.resendAfterSec).toBe(30);
    // TTL contract advertised at issue time: 5 minutes (manual step 5 window).
    expect(s1.body.expiresInSec).toBe(300);

    const tooSoon = await requestOtp(phone);
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body?.error?.code).toBe('RESEND_TOO_SOON');

    // Dev-assisted (manual marks step 2/5 dev-assisted): age the open session past the lock.
    await backdateOtpSession(s1.body.otpSessionId, 'createdAt', isoAgo(60_000));
    const s2 = await requestOtp(phone);
    expect(s2.status).toBe(200);
    expect(s2.body.devOtp).toMatch(/^\d{6}$/);

    // Step 3: the OLD OTP is rejected (generic invalid/expired, no account-existence leak).
    const oldOtp = await verifyOtp(phone, s1.body.devOtp, s1.body.otpSessionId);
    expect(oldOtp.status).not.toBe(200);
    expect(oldOtp.body?.accessToken).toBeFalsy();
    expect(['OTP_INVALID', 'OTP_EXPIRED', 'OTP_SESSION_NOT_FOUND']).toContain(oldOtp.body?.error?.code);

    // Wrong OTP on the live session → generic error, no existence leak either.
    const wrongOtp = await verifyOtp(phone, '000000', s2.body.otpSessionId);
    expect(wrongOtp.status).toBe(400);
    expect(wrongOtp.body?.error?.code).toBe('OTP_INVALID');
    expect(JSON.stringify(wrongOtp.body)).not.toMatch(/registered|exists|account/i);

    // Step 4: the NEW OTP verifies (one-shot), replay fails, session stays valid.
    const ok = await verifyOtp(phone, s2.body.devOtp, s2.body.otpSessionId);
    expect(ok.status).toBe(200);
    expect(ok.body?.accessToken).toBeTruthy();
    const replay = await verifyOtp(phone, s2.body.devOtp, s2.body.otpSessionId);
    expect(replay.status).toBe(404);
    expect(replay.body?.error?.code).toBe('OTP_SESSION_NOT_FOUND');
    expect(replay.body?.accessToken).toBeFalsy();
    // Session issued by the first (successful) verify is still valid.
    const stillValid = await api.get('/kyc/status', ok.body.accessToken);
    expect(stillValid.status).toBe(200);

    // Step 5 (dev-assisted): an OTP past its 5-minute TTL is rejected with a generic expiry error.
    const phone2 = freshPhone();
    const s3 = await requestOtp(phone2);
    expect(s3.status).toBe(200);
    await backdateOtpSession(s3.body.otpSessionId, 'expiresAt', isoAgo(5_000));
    const expired = await verifyOtp(phone2, s3.body.devOtp, s3.body.otpSessionId);
    expect(expired.status).toBe(400);
    expect(expired.body?.error?.code).toBe('OTP_EXPIRED');
    expect(expired.body?.accessToken).toBeFalsy();
  });

  test('TC-FRM-05: switch app language to हिन्दी and check home/mandi labels', async ({ farmerPage }) => {
    // Manual step 1 (web adaptation): header language button → हिन्दी.
    await farmerPage.goto('/farmer');
    const langButton = farmerPage.getByRole('button', { name: /english/i }).first();
    await expect(langButton).toBeVisible();
    await langButton.click();
    await farmerPage.getByRole('button', { name: /हिन्दी/i }).first().click();
    // The toggle itself works: the header now shows हिन्दी and persists across pages.
    await expect(farmerPage.getByRole('button', { name: /हिन्दी/i }).first()).toBeVisible();

    // Manual step 2-3: home greeting + service grid must render Devanagari labels.
    await farmerPage.goto('/farmer');
    await expect(farmerPage.getByRole('heading', { name: /राम राम/i })).toBeVisible();
    await expect(farmerPage.getByText(/मंडी भाव|लाइव मंडी भाव/i).first()).toBeVisible();

    // Manual step 4: Mandi Prices page renders its heading in Hindi UI.
    await farmerPage.goto('/farmer/mandi');
    await expect(farmerPage.getByRole('heading', { name: /मंडी भाव/i })).toBeVisible();

    // Manual step 5: switch back to English.
    await farmerPage.getByRole('button', { name: /हिन्दी/i }).first().click();
    await farmerPage.getByRole('button', { name: /english/i }).first().click();
    await expect(farmerPage.getByRole('button', { name: /english/i }).first()).toBeVisible();
  });

  test('TC-FRM-06: submit KYC in the UI, admin approves, status becomes verified', async ({ farmerPage, farmerApi, adminApi }) => {
    // Steps 1-3 (farmer UI): open the KYC case and upload the farmer document set.
    await farmerPage.goto('/kyc');
    await expect(farmerPage.getByRole('heading', { name: /kyc verification cases/i })).toBeVisible();
    await farmerPage.getByRole('button', { name: /open \/ refresh case/i }).click();
    await expect(farmerPage.getByText(/kyc case opened for farmer/i)).toBeVisible();
    // Farmer document matrix required by the backend: aadhaar + pan + bank.
    await expect(farmerPage.getByText(/aadhaar/i).first()).toBeVisible();
    await expect(farmerPage.getByText(/pan/i).first()).toBeVisible();

    // Step 2: upload Aadhaar front (jpeg). The UI has no Aadhaar-number field; the
    // masked-storage note is the product requirement displayed on this page.
    await expect(farmerPage.getByText(/masked aadhaar/i)).toBeVisible();
    const fileInput = farmerPage.locator('input[type="file"]');
    await farmerPage.getByRole('button', { name: /^upload$/i }).first().click();
    await fileInput.setInputFiles(AADHAAR_JPG);
    await expect(farmerPage.getByText(/uploaded — verification usually completes/i)).toBeVisible({ timeout: 15_000 });

    // Step 3: upload PAN + bank proof → case created, status pending.
    await farmerPage.getByRole('button', { name: /^upload$/i }).first().click();
    await fileInput.setInputFiles(PAN_JPG);
    await expect(farmerPage.getByText(/uploaded — verification usually completes/i)).toBeVisible({ timeout: 15_000 });
    await farmerPage.getByRole('button', { name: /^upload$/i }).first().click();
    await fileInput.setInputFiles(BANK_JPG);
    await expect(farmerPage.getByText(/uploaded — verification usually completes/i)).toBeVisible({ timeout: 15_000 });
    await expect(farmerPage.getByText(/^pending$/i).first()).toBeVisible();

    // API cross-check before the admin acts: case exists with all three docs pending.
    const before = await api.get('/kyc/status', farmerApi.accessToken);
    expect(before.status).toBe(200);
    const caseBefore = (before.body?.data ?? []).find((c: any) => c.persona === 'farmer');
    expect(caseBefore).toBeTruthy();
    expect(caseBefore.status).toBe('pending');
    expect(caseBefore.docs.map((d: any) => d.status)).toEqual(['pending', 'pending', 'pending']);

    // Step 4 [ADMIN]: approve every pending doc of this farmer on the super-admin side.
    const approved = await adminVerifyAllKycDocs(adminApi.accessToken, farmerApi.user.id);
    expect(approved).toBeGreaterThanOrEqual(3);

    // Step 4 expectation: status becomes verified (API) ...
    const after = await api.get('/kyc/status', farmerApi.accessToken);
    const caseAfter = (after.body?.data ?? []).find((c: any) => c.persona === 'farmer');
    expect(caseAfter?.status).toBe('verified');
    expect(caseAfter.docs.map((d: any) => d.status)).toEqual(['verified', 'verified', 'verified']);

    // Step 5: re-open the KYC screen — verified badge shown, documents listed.
    await farmerPage.reload();
    await expect(farmerPage.getByText(/^verified$/i).first()).toBeVisible();
    await expect(farmerPage.getByText(/^aadhaar$/i)).toBeVisible();
    await expect(farmerPage.getByText(/^pan$/i)).toBeVisible();
  });

  test('TC-FRM-07: KYC negatives — wrong document matrix, 6MB file, .txt file', async () => {
    // Throwaway farmer so the shared account is untouched.
    const phone = freshPhone();
    const onboard = await api.post('/auth/onboard', {
      phone,
      name: 'FRM07 Throwaway',
      mpin: '4321',
      persona: 'farmer',
      state: FARMER.state,
      district: FARMER.district,
    });
    expect(onboard.status).toBe(200);
    const token = onboard.body.accessToken as string;

    // Valid case first (gives us real caseId/docIds for the file-negatives).
    const valid = await api.post('/kyc/cases', { persona: 'farmer', docs: [{ type: 'aadhaar' }, { type: 'pan' }, { type: 'bank' }] }, token);
    expect(valid.status).toBe(201);
    const caseId = valid.body.case.caseId as string;
    const docIds = Object.fromEntries((valid.body.case.docs as any[]).map((d) => [d.type, d.docId]));

    // Negative 1: document set that does not match the farmer matrix → rejected, no case created.
    const wrongMatrix = await api.post('/kyc/cases', { persona: 'farmer', docs: [{ type: 'aadhaar' }, { type: 'random_photo' }] }, token);
    expect(wrongMatrix.status).toBe(422);
    expect(wrongMatrix.body?.error?.code).toBe('INVALID_DOCUMENT_MATRIX');
    expect(JSON.stringify(wrongMatrix.body)).toMatch(/random_photo|not allowed for persona farmer/i);

    // Negative 2: 6MB file → rejected "file must be ≤ 5 MB".
    const tooBig = await uploadKycDoc(token, caseId, docIds.aadhaar, BIG_JPG, 'image/jpeg', 'oversize.jpg');
    expect(tooBig.status).toBe(400);
    expect(JSON.stringify(tooBig.body)).toMatch(/exceeds 5 ?MB/i);

    // Negative 3: .txt file → rejected as invalid file type.
    const wrongType = await uploadKycDoc(token, caseId, docIds.pan, NOTE_TXT, 'text/plain', 'notes.txt');
    expect(wrongType.status).toBe(400);
    expect(JSON.stringify(wrongType.body)).toMatch(/unsupported content type/i);

    // Nothing from the rejected uploads stuck: docs still pending, case still pending.
    const st = await api.get('/kyc/status', token);
    const kyc = (st.body?.data ?? []).find((c: any) => c.persona === 'farmer');
    expect(kyc.status).toBe('pending');
    expect(kyc.docs.every((d: any) => d.status === 'pending' && !d.storagePath)).toBe(true);
  });
});
