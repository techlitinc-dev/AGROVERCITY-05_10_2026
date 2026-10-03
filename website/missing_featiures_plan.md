# Missing Features — Completion Plan (Backend + Website)

*Execution plan for `website/missing_all_features.md` — turns the atlas into a sequenced,
dependency-ordered build. Follows the conventions proven in `plan/dairy_plan.md` and
`plan/broker_plan.md` (ground truth → prerequisites → phases → verification).*

*Verified 2026-10-02: backend 70 routers / 535 endpoints / 688 tests green · website build green.*

---

## 0. Ground truth

| Source | What it gives this plan |
|---|---|
| `website/missing_all_features.md` §3 | 39 backend-ready router families without UI (the leverage list) |
| `website/missing_all_features.md` §4 | 11 greenfield gaps G1–G11 (payments, SaaS, admin UI, search, tasks, PWA…) |
| `backend/app/services/payments.py` | **Razorpay already integrated** (`create_razorpay_order`, `verify_razorpay_signature`, `refund_razorpay_payment`, dev fallbacks) — G1 is exposure + ledger, not gateway work |
| `backend/app/routers/admin.py` | Superadmin back-office exists (role = `isAdmin` flag / `activeProfile == "admin"`); needs UI + a handful of write endpoints |
| `backend/app/services/storage.py`, `reports.py`, `bank_verify/` | Uploads, PDF reports, penny-drop — reuse, don't rebuild |
| `website/src/` module playbook | The exact pattern used for 5 modules (dairy/gaushala/vetnet/animals/analytics) — replicated per phase |

---

## 1. Guiding principles

1. **Backend-first where greenfield, UI-first where backend-ready.** §3 items need almost no backend
   work — they are screen-building exercises. §4 items are backend-first.
2. **Money in one place.** All payment capture/release/refund/commission flows through a single
   `payments` ledger (Phase A). No module invents its own money path.
3. **Every endpoint role-gated; every screen `t()`-wrapped** with en/hi parity; tests before phase close.
4. **One module playbook everywhere** (§2) — any dev or agent executes a phase without re-deciding structure.
5. **Rollout behind feature flags** (`app_config`) — the dashboard already gates tools by persona;
   add flag gating so phases can land on `main` dark.

---

## 2. The module playbook (proven pattern — copy exactly)

**Backend (per domain):** `app/routers/<domain>.py` (tagged, `_error` envelope, `require_role`,
`_envelope` paging) + `app/models/<domain>.py` (pydantic In/Out) + register in `main.py` +
`tests/test_<domain>.py`. Reuse `services/` before writing new logic.

**Website (per domain):**
```
website/src/lib/api/<domain>.ts        typed interfaces + thin axios wrappers (Paged<T>, ApiError)
website/src/lib/i18n/locales/en.<domain>.ts + hi.<domain>.ts   registerLocale; full key parity
website/src/theme/<domain>.css         classes on tokens.css
website/src/views/<domain>/
  index.ts                             export <DOMAIN>_PAGES: Record<string, ComponentType>
  <Hub>.tsx                            tool page: useEnsureProfile + role gate
  <Section>/<Page>.tsx                 ToolShell-wrapped pages, load() pattern, ModalSheet forms
website/src/views/dashboard/ToolPage.tsx   add <DOMAIN>_PAGES to the ?? chain (ONE edit)
website/src/App.tsx                        add deep routes inside the loggedIn gate (ONE edit)
```

**Integration gate (catches what tsc misses):** after parallel work, run `pnpm build` (vite/rollup
resolves imports tsc tolerates), the locale parity diff, and the `t()`-key audit (scripts in
`missing_all_features.md` §6). Import-depth bugs (`../../../theme` vs `../../theme`) are the
recurring failure — the build gate exists for them.

---

## 3. Phase A — Platform unlocks (backend-first; everything else depends on these)

**Goal:** money movement, attribution, discovery, daily-habit hooks. *Effort ~8 dev-days.*

### A1. Payments router (`routers/payments.py` — NEW; razorpay service already exists)
| Endpoint | Purpose |
|---|---|
| `POST /payments/order` `{refType, refId, amountPaise}` | Gateway order (purchase, booking, equipment order, subscription) → `{orderId, gatewayOrderId, amount, keyId}` |
| `POST /payments/verify` `{gatewayOrderId, gatewayPaymentId, signature, refType, refId}` | HMAC verify → `payments` doc `status: captured`, **commission deducted at source** per A2, escrow flag per refType |
| `POST /payments/{id}/refund` `{amountPaise?, reason}` | Refund via service; doc → `refunded`; downstream cancel hooks |
| `GET /payments?refType=&refId=` | Ledger view (owner or admin) |

Collection `payments`: `{id, refType, refId, payerUid, payeeUid, amountPaise, commissionPaise, netPaise, gateway, gatewayOrderId, gatewayPaymentId, escrow: held|released|na, status, createdAt}`.

### A2. Commission engine (inside payments router + admin config)
- `app_config`-style doc `commission_config` `{category: {percent, capPaise}}` (trade default 3%, transport 5%, equipment 4%, dairy 2% — blueprint-consistent).
- Deduction at capture; `commission_ledger` entries; `GET /admin/commission` (sum by day/category).
- Escrow rules by refType: `purchase` → release on QC accept; `order` → release on delivered+paid; cancel → refund.

### A3. Referral fix (backend gap blocking the loop)
- `POST /auth/register` accepts `referralCode` → attribution via existing `referrals.py` engine (+100 coins both sides after first completed transaction, per existing rules).

### A4. Notification preferences
- `GET/PUT /users/me/notification-prefs` `{order, payment, advisory, scheme, marketing}` toggles; `services/notifications.py` honors them.

### A5. Global search
- `GET /search?q=&types=schemes,content,products,vets,gaushalas,courses,news,mandi&limit=` → grouped results; substring over indexed fields; 100ms target at demo scale.

### A6. Task engine
- `GET /tasks/today` → generated from existing data: payment dues (pending batches), vaccination `nextDueDate` ≤ 7d (livestock), breeding `pregnancyCheckDueDate`/`expectedCalvingDate` ≤ 14d, stale lots > 7d (trade), campaign windows, unclaimed referral reward, unreviewed KYC (admin). Pure aggregation — no new user input needed for v1.

**Tests:** `tests/test_payments.py` (order/verify happy path with dev gateway, signature fail, refund, commission math, escrow release), referral attribution, search grouping, task generation. **Exit:** pytest green; verify-capture flow exercisable via curl.

**Website in A:** register wizard gains referral-code field (1 screen). Nothing else.

---

## 4. Phase B — Money & protection UI *(backend-ready; screen-building)*

**Goal:** loans, insurance, schemes, vault live for farmers + review consoles for bank/insurer personas. *Effort ~12 dev-days.*

| Workstream | Backend delta (minimal) | Website build |
|---|---|---|
| B1 Loans | presigned upload for docs (reuse `storage.py`) | `views/loans`: farmer apply wizard (eligibility via existing endpoint, doc upload, status tracking `loanTracking`), `views/bankmgr`: `loanDashboard` + `loanReview` queues (approve/reject w/ reason) |
| B2 Insurance | — | `views/insurance`: farmer browse policies, buy (quote → payment via A1), `myPolicies`, claim wizard + status; `views/insurer`: `insurancePolicyReview`, `insuranceClaimReview` queues |
| B3 Schemes | — | `views/schemes`: directory w/ state/category chips, detail, eligibility checker, save/bookmark |
| B4 Vault | — | `views/vault`: folder-ish doc list, upload (presign), status chips (pending/verified/rejected), download |

Persona allowlists in `lib/dashboard.ts` already name these tool ids — pages land without registry changes beyond the playbook's two one-line edits. **Exit:** farmer can apply→track a loan and file a claim end-to-end in the browser; bank/insurer queues drain.

---

## 5. Phase C — Admin console

**Goal:** the 483-line superadmin backend gets its cockpit. *Effort ~10 dev-days.*

- **Backend additions:** `PUT /admin/commission` (A2 config), `POST /admin/broadcast` (FCM + inbox), `GET/PUT /admin/feature-flags` (rollout gating), dispute ticket endpoints `{raise on booking/purchase, triage, verdict: full-release|partial|refund}` writing to A1 ledger.
- **Website:** `views/admin` (NOT a persona tool — route group `/admin/*` gated by `isAdmin`, entry link shown only for admin users): Overview KPIs (existing `/admin/overview` — 26-module metrics), Users (+suspend/ban), KYC queue (side-by-side doc view, approve/reject reason codes), Expert handoffs, Courses queue (feature/approve), E-market analytics, Finance/loans underwriting, Disputes, Commission config, Feature flags, Broadcast.
- **Exit:** a superadmin can run KYC→user→dispute→commission entirely from the web.

---

## 6. Phase D — Knowledge, AI & growth *(backend-ready)*

**Goal:** daily-habit moat. Split into 3 parallel tracks. *Effort ~20 dev-days.*

- **D1 EdTech:** `views/courses` — catalog w/ category/search, course detail (syllabus, instructor, rating), enroll + lesson player (mark progress), `myLibrary`, instructor studio (`teachers` endpoints: create course → goes to admin queue, earnings, jobs board). 
- **D2 Content & advisory:** `views/content` — agriNews, gyan articles, liveChannels (existing `content.py`/`gyan.py`); `views/advisory` — advisory feed + sowing-intent capture; **chatbot UI** — floating assistant + full page wired to existing `chatbot.py`; **weather detail** — 7-day forecast + spray-window card (existing `weather.py`/`climate.py`).
- **D3 Growth loops:** `referEarn` page (code share card, attribution tree, reward history) + registration referral field (A3); `gamification` surfaces — coins balance pill in header, badges/streaks page, coin earn/burn history; scheme-deadline + referral tasks surface via A6.

**Exit:** DAU has a reason to open daily (content/weather/tasks); referrals complete end-to-end.

---

## 7. Phase E — Commerce breadth *(needs A for checkout)*

**Goal:** e-market GMV + seller self-serve + equipment vertical. *Effort ~20 dev-days, parallel tracks.*

- **E1 E-market:** `views/emarket` — catalog (categories, search, ratings), product detail, cart, checkout → **A1 payments**, `orders` list/detail, `orderTracking` timeline (existing event feed), `wishlist`, `priceAlerts` (create/list, triggers via notifications), ratings write post-delivery, `addresses` CRUD at checkout.
- **E2 Seller tools:** `myProducts`/`sellerProducts` — listing CRUD w/ images (presigned uploads), stock, orders inbox, returns.
- **E3 Equipment:** `views/equipment` — renter browse/search/slots → book → **A1 pay**; owner console (`machineManage`, `slotCalendarManage`, utilization dashboard from `equipment_owner.py`).
- **E4 Institutions:** `fpo` page (profile, pools join, machinery calendar).

**Exit:** a buyer completes a paid order; a seller lists a product; an owner rents a machine — all in-platform money via A1.

---

## 8. Phase F — Assets & farm services

**Goal:** landlord persona + asset-heavy farmers. *Effort ~10 dev-days.*

- `views/land`: `landlordPlots`, `landListings`, `leaseRequests`, rent tracking (backend `land.py` + `land_records.py` for 7/12 extracts).
- `views/water`, `views/tree`: scheme browsing, plantation tracking.
- `views/soiltests`: booking flow (slot + address), result view once lab/admin uploads (reuse vault).
- `post_harvest` guidance pages (805-line router: cold storage, testing, best practices — directory + booking style UI).

**Exit:** landlord journey (list → lease → rent collection) works end-to-end.

---

## 9. Phase G — SaaS money layer *(needs A + C)*

**Goal:** the actual SaaS business. *Effort ~10 dev-days.*

- **Backend:** `plans` collection (`{id, name, pricePaise, interval, audience: dairy|gaushala|seller, meter: perMember|flat, features[]}`); `POST /billing/subscribe` (razorpay subscription or manual UPI-recorded); **metering job**: monthly invoice = plan base + max(0, members − included) × perMember rate, computed from `dairy_members` counts (existing collections — no new instrumentation); `billing_invoices` collection + GST-compliant PDF (reuse `services/reports.py`); `GET /billing/invoices`; `POST /admin/plans` CRUD (Phase C console); TDS statement export.
- **Website:** billing section inside `dairyConsole`/`gaushalaConsole` settings (current plan, usage meter, invoices, upgrade); paywall gates: >N members or analytics history >3 months prompts subscribe (flag-gated).
- **Exit:** a dairy center on the free tier hits the member cap and upgrades to paid — real MRR.

---

## 10. Phase H — Heaven & moat

**Goal:** differentiation + scale hardening. *Effort ~15 dev-days, many parallel.*

- **H1 Women hub** (`women.py`): SHG/livestock/garden/enterprise tabs.
- **H2 PWA + perf:** hand-rolled `manifest.webmanifest` + service worker (cache shell, offline queue for form drafts — no new dep); **route-level code-splitting** via `React.lazy` for all tool pages (1.4 MB → <400 KB first load budget); image lazy-loading.
- **H3 Vernacular depth:** export the full en key catalog, batch-translate the 28 partial locales, add the parity-audit script to CI (fail build on missing keys).
- **H4 Trust & safety:** report-user on profiles/chat, block list, dispute raise from purchase/booking (Phase C endpoints), moderation flags surface in admin.
- **H5 Data insights (B2B):** `GET /admin/insights` aggregates (anonymized, k-anon ≥ 25): district mandi benchmarks, dairy throughput indices, demand forecasts — sellable report export.
- **H6 Scale hygiene:** paginate the known global-scan endpoints (dairy batches/slips flagged B4, search, content lists); add composite indexes (`firestore.indexes.json` already exists — extend).

**Exit:** Lighthouse PWA installable; first-load budget met; 30-locale parity green.

---

## 11. Master sequencing

```
A (unlocks) ──► E, G ──► (G needs C for plan config)
   └──► B, C, D, F run in parallel any time after A's referral/search/tasks if they use them (they mostly don't)
H runs continuously once its tracks' targets exist (H2/H3 anytime; H4 after C; H5 after E)
```

| Phase | Depends | Backend new | Website new | Effort |
|---|---|---|---|---|
| A Platform unlocks | — | payments, commission, referral fix, prefs, search, tasks | 1 field | ~8 d |
| B Money & protection | — | uploads only | 4 modules | ~12 d |
| C Admin console | A2 (commission) | 5 endpoints + disputes | 1 module (11 pages) | ~10 d |
| D Knowledge/AI/growth | — | — | 3 modules | ~20 d |
| E Commerce | A1 | — | 4 modules | ~20 d |
| F Assets | — | — | 3 modules | ~10 d |
| G SaaS billing | A, C | plans, metering, invoices | console sections | ~10 d |
| H Heaven & moat | C (H4), E (H5) | insights, flags | misc | ~15 d |

**Total ≈ 105 dev-days** — comfortably a 4–5 month build with 2 engineers + agent swarms per phase
(Phase D/E/F alone parallelize into 7 independent module tracks using the playbook's file-ownership
rules; the dairy build proved 4 parallel agents + integration gate works).

**Priority cut for a demo-able "million-dollar" story:** A → B1 → C(overview+KYC) → E1 → G.
That sequence alone shows: farmer applies for a loan, platform admin approves KYC, buyer pays for
produce in escrow, dairy center upgrades to a paid plan.

---

## 12. Verification & rollout (every phase)

- [ ] Backend: new `tests/test_<domain>.py`; **full suite green** (baseline today: 688 passed, 45 pre-existing transport failures — never add to that list)
- [ ] Website: `pnpm exec tsc --noEmit` → 0; `pnpm build` green; en/hi parity diff clean; `t()`-key audit clean
- [ ] End-to-end smoke: the phase's hero flow walked in a browser against local backend (`run.sh`)
- [ ] Feature flag added (default off) where user-visible; `endpoints.md` §-append for every new endpoint; plan log updated
- [ ] Rollout order: dev seed → demo script update → manual QA checklist entry in `docs/test-reports/`

---

## 13. Risks & open questions

1. **Gateway choice:** razorpay service code exists — confirm account/KYC path before Phase A demo; dev fallback covers all tests until then.
2. **Firestore scan costs:** A5 search + D feeds need pagination discipline (H6); at 10× demo data the global scans must be gone.
3. **DPDP/consent:** payments + vault + insights need consent flags (consents collection exists — wire it).
4. **Escrow semantics:** keep legally simple — "platform hold", not a licensed escrow; wording review before real money.
5. **Bundle split risk:** lazy routes touch every module's index.ts — schedule H2 as its own focused change, not folded into feature work.

---

## 14. Implementation log

| Date | Change |
|---|---|
| 2026-10-02 | Plan authored from `website/missing_all_features.md`; phases A–H defined with dependency graph, effort model, and the proven module playbook as the execution standard. No code changes. |

---

*End of plan. Execute Phase A first — every rupee of revenue after it routes through one ledger.*
