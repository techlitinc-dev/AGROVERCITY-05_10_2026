# phase-04 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

Conventions used below:
- `backend pytest` means cwd `backend/`, command `.venv/bin/python -m pytest <args>`.
- `website tsc` means cwd `website/`, command `pnpm exec tsc --noEmit`.
- All new user-facing strings go through `t()` with keys added to BOTH the en
  and hi locale file of the domain (playbook §3 rules 3/6). No
  `alert()`/`prompt()`/`confirm()`, no `?? <number>` fallbacks, no TODOs.
- All money is integer paisa server-side (playbook §3 rule 6). All new write
  endpoints accept `Idempotency-Key` and return the `{"error":{code,...}}`
  envelope on failure (playbook §3 rule 7).

## WS-01 — Learner side 'Krishi Academy'  (see instructions.md §WS-01)

### Task 1.1 — Audit existing learner endpoints
- DO: Read-only audit. Confirm the endpoints instructions.md §WS-01 "Backend facts" relies on exist: in `backend/app/routers/courses.py` the routes `POST /courses`, `GET /courses`, `GET /courses/mine`, `GET /courses/purchased/list`, `GET /courses/my-learning`, `GET /courses/{course_id}`, `POST /courses/{course_id}/purchase`, `POST /courses/purchases/verify`, `POST /courses/{course_id}/enroll`, `GET /courses/{course_id}/learn`, `POST /courses/{course_id}/lessons/{lesson_id}/progress`, `GET /courses/{course_id}/certificate`, the reviews and questions routes; in `backend/app/routers/teachers.py` the route `GET /certificates/verify/{certificate_id}`; in `backend/app/routers/gamification.py` the route `GET /status`. Change nothing.
- RUN: `grep -cE '@router\.(get|post|put|delete)\("/courses' backend/app/routers/courses.py && grep -c 'certificates/verify' backend/app/routers/teachers.py && grep -c '@router.get("/status"' backend/app/routers/gamification.py`
- EXPECT: first count ≥ 19, second count = 1, third count = 1.
- IF FAIL: the repo contradicts instructions.md §WS-01 — STOP the phase (playbook §5) and report the mismatch.
- [ ]

### Task 1.2 — Create academy locale pair
- DO: Create `website/src/lib/i18n/locales/en.academy.ts` (new) following the exact pattern of `website/src/lib/i18n/locales/en.trade.ts`: `import { registerLocale } from '../index';`, a `const enAcademy: Record<string, string> = { ... };`, and a final `registerLocale('en', enAcademy);`. Create `website/src/lib/i18n/locales/hi.academy.ts` (new) the same way with `hiAcademy` and `registerLocale('hi', hiAcademy);`. Seed both with this first key set (English / Hindi): `academyCatalogTitle` ('Krishi Academy — Courses' / 'कृषि अकादमी — पाठ्यक्रम'), `academySearchPlaceholder` ('Search courses…' / 'पाठ्यक्रम खोजें…'), `academyFilterCategory` ('Category' / 'श्रेणी'), `academyFilterLevel` ('Level' / 'स्तर'), `academyFilterLanguage` ('Language' / 'भाषा'), `academyFilterPrice` ('Price' / 'कीमत'), `academyFilterFree` ('Free' / 'निःशुल्क'), `academyFilterPaid` ('Paid' / 'सशुल्क'), `academyCoinsDiscount` ('AgriCoins discount available' / 'एग्रीकॉइन छूट उपलब्ध'), `academyRatingLabel` ('Rating' / 'रेटिंग').
- RUN: website tsc
- EXPECT: exit 0, no errors.
- IF FAIL: fix the reported TypeScript error in the two new files only.
- [ ]

### Task 1.3 — Register academy locales in main.tsx
- DO: In `website/src/main.tsx`, add two lines immediately after the existing `import './lib/i18n/locales/hi.trade';` line: `import './lib/i18n/locales/en.academy';` and `import './lib/i18n/locales/hi.academy';`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: correct the import paths to match the files created in task 1.2.
- [ ]

### Task 1.4 — Create Razorpay checkout helper
- DO: Create `website/src/lib/api/razorpayCheckout.ts` (new) — the single web wrapper for Razorpay `checkout.js` (instructions.md §Repo orientation: do not scatter `window.Razorpay` across views). Exact shape: a module-level `let scriptPromise: Promise<void> | null = null;`; `export function loadRazorpayScript(): Promise<void>` that injects `<script src="https://checkout.razorpay.com/v1/checkout.js">` once and resolves on load; `export interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }`; `export async function openRazorpayCheckout(opts: { orderId: string; amountPaisa: number; name: string; description: string; prefill?: { name?: string; contact?: string }; onSuccess: (r: RazorpaySuccess) => void; onDismiss?: () => void }): Promise<void>` which awaits `loadRazorpayScript()`, then opens `new (window as any).Razorpay({ key: import.meta.env.VITE_RAZORPAY_KEY_ID, order_id: opts.orderId, amount: opts.amountPaisa, currency: 'INR', name: opts.name, description: opts.description, prefill: opts.prefill, handler: opts.onSuccess, modal: { ondismiss: opts.onDismiss } })`. Amount is passed in integer paisa — never multiply by 100 here (callers pass paisa).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the reported error in the new file only.
- [ ]

### Task 1.5 — Add VITE_RAZORPAY_KEY_ID placeholder
- DO: Append to `website/.env.example` (do NOT create or edit any real `.env` — playbook §3 rule 5): a comment line `# Razorpay publishable key id for checkout.js (real value from the human operator)` followed by `VITE_RAZORPAY_KEY_ID=`.
- RUN: `grep -c 'VITE_RAZORPAY_KEY_ID' website/.env.example`
- EXPECT: prints `1`.
- IF FAIL: re-open the file and confirm the append landed; retry once.
- [ ]

### Task 1.6 — Add qrcode dependency
- DO: From cwd `website/`, run `pnpm add qrcode && pnpm add -D @types/qrcode` to add the certificate-QR dependency (instructions.md §Repo orientation).
- RUN: `grep -c '"qrcode"' website/package.json`
- EXPECT: prints `1` (or more); command exited 0.
- IF FAIL: re-run the pnpm add command once; if the registry is unreachable, STOP and report.
- [ ]

### Task 1.7 — Create courses.ts wrapper: catalog reads
- DO: Create `website/src/lib/api/courses.ts` (new) following the conventions of `website/src/lib/api/instructorAcademy.ts` (read it first — same client import, same error handling, same doc-comment style; document backend quirks in comments as that file does). Export: `CourseSummary` and `CourseDetail` TypeScript interfaces mirroring the `courses` collection doc (fields incl. `id`, `title`, `category`, `priceRupees`, `coinsDiscountAllowed`, `ratingAverage`, `ratingCount`, `instructorId`, `instructorName`, `status`); `listCourses(params: { category?: string; level?: string; language?: string; maxPrice?: number; freeOnly?: boolean; search?: string; page?: number; pageSize?: number })` → `GET /v1/courses`; `getCourse(courseId: string)` → `GET /v1/courses/{id}`; `getMyLearning()` → `GET /v1/courses/my-learning`; `getPurchasedCourses()` → `GET /v1/courses/purchased/list`; `getCoinBalance()` → `GET /v1/gamification/status`, returning the numeric coin balance field from that response.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: align imports/return types with `instructorAcademy.ts` conventions; fix only the new file.
- [ ]

### Task 1.8 — Extend courses.ts: purchase and learn
- DO: Append to `website/src/lib/api/courses.ts`: `purchaseCourse(courseId: string)` → `POST /v1/courses/{id}/purchase`; `enrollCourse(courseId: string, opts: { useCoins: boolean; coinsToRedeem: number })` → `POST /v1/courses/{id}/enroll` with JSON body `{ useCoins, coinsToRedeem }`; `verifyCoursePurchase(body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string })` → `POST /v1/courses/purchases/verify`; `getCourseLearning(courseId: string)` → `GET /v1/courses/{id}/learn`; `postLessonProgress(courseId: string, lessonId: string, body: { completed: boolean })` → `POST /v1/courses/{id}/lessons/{lesson_id}/progress`; `getCertificate(courseId: string)` → `GET /v1/courses/{id}/certificate` (response includes `verificationUrl`). Comment that coin redemption happens on the enroll endpoint (backend quirk: `/purchase` takes no body).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the appended code.
- [ ]

### Task 1.9 — Extend courses.ts: reviews, Q&A, verify
- DO: Append to `website/src/lib/api/courses.ts`: `listReviews(courseId)` / `addReview(courseId, body: { rating: number; comment: string })` → `GET`/`POST /v1/courses/{id}/reviews`; `listQuestions(courseId)` / `postQuestion(courseId, body: { question: string })` / `postAnswer(courseId, questionId, body: { answer: string })` → the `/v1/courses/{id}/questions` routes; `verifyCertificatePublic(certificateId: string)` → `GET /v1/teachers/certificates/verify/{id}` (public, no auth header needed — comment this).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the appended code.
- [ ]

### Task 1.10 — Create CourseCatalogPage
- DO: Create `website/src/views/academy/CourseCatalogPage.tsx` (new). Uses `listCourses` + `getCoinBalance` from task 1.7. Renders: filter controls for category/crop, level, language, price, and a free/paid toggle; a free-text search box bound to the `search` param; a grid of course cards each showing fee (₹ from `priceRupees`), rating (`ratingAverage`), instructor name with credential-badge slot (render `instructorCredentials` array when present — badges DGCA/NABARD/degree; empty array renders nothing), and a coins-discount chip when `coinsDiscountAllowed > 0`. All strings via `t()` — add every new key to BOTH `en.academy.ts` and `hi.academy.ts`. No `?? <number>` fallbacks; no `alert()`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and the two locale files.
- [ ]

### Task 1.11 — Create CourseDetailPage
- DO: Create `website/src/views/academy/CourseDetailPage.tsx` (new). Reads `:courseId` from the route. Uses `getCourse`, `listReviews`, `addReview`, `listQuestions`, `postQuestion`, `postAnswer`. Renders: modules/lessons list; reviews list + an add-review form (rating 1–5 + comment); instructor profile block with credential badges (same `instructorCredentials` slot as task 1.10); Q&A threads with a post-question form and per-question answers (instructor and learner answers). All strings `t()` en+hi; no hardcoded strings, no `?? <number>`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and the locale files.
- [ ]

### Task 1.12 — Create PurchaseSheet with capped coin slider
- DO: Create `website/src/views/academy/PurchaseSheet.tsx` (new). Reads `:courseId`. Loads the course and coin balance. Coin slider max is exactly `Math.min(course.coinsDiscountAllowed, Math.floor(course.priceRupees), Math.floor(course.priceRupees * 0.5), coinBalance)` (X11 ≤50%-of-order cap — instructions.md §WS-01 steps 2/6). Checkout flow: call `openRazorpayCheckout` (task 1.4) with the order from `purchaseCourse`/`enrollCourse` (amount converted rupees→paisa by `Math.round(remaining * 100)` at this call site only), on success call `verifyCoursePurchase`, then auto-call `enrollCourse`, then navigate to the player. Errors surface through the toast/modal system — never `alert()`. All strings `t()` en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and the locale files.
- [ ]

### Task 1.13 — Create MyLearningPage
- DO: Create `website/src/views/academy/MyLearningPage.tsx` (new). Lists `getMyLearning()` results with a progress bar per course (`progressPercent`) and a continue-button deep-linking to the player for that course. All strings `t()` en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and the locale files.
- [ ]

### Task 1.14 — Create CoursePlayerPage
- DO: Create `website/src/views/academy/CoursePlayerPage.tsx` (new). Reads `:courseId`. Loads `getCourseLearning(courseId)`, renders the lesson list; each lesson row has a complete-toggle calling `postLessonProgress` and updating local progress; when progress reaches 100% (or `isCompleted`), render a certificate CTA navigating to the certificate page. All strings `t()` en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and the locale files.
- [ ]

### Task 1.15 — Create CertificatePage with QR
- DO: Create `website/src/views/academy/CertificatePage.tsx` (new). Reads `:courseId`. Loads `getCertificate(courseId)`; renders certificate detail plus a QR code (use the `qrcode` package from task 1.6 — `QRCode.toDataURL(cert.verificationUrl)` into an `<img>`) encoding the `verificationUrl`; a share/download block. All strings `t()` en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page.
- [ ]

### Task 1.16 — Create public VerifyCertificatePage
- DO: Create `website/src/views/academy/VerifyCertificatePage.tsx` (new). Reads `:certificateId` from the route; calls `verifyCertificatePublic`; renders validity state, recipient name, course title, issue date, and credential — or the not-found state when the API returns the error envelope. Works logged out (no auth store dependency). All strings `t()` en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page.
- [ ]

### Task 1.17 — Create ACADEMY_PAGES registry and routes
- DO: Create `website/src/views/academy/index.tsx` (new) exporting `ACADEMY_PAGES: Record<string, ComponentType>` mapping `courses` → `CourseCatalogPage`, `courseDetail` → `CourseDetailPage`, `myLearning` → `MyLearningPage` (pattern: `website/src/views/instructor/index.tsx`). Merge `ACADEMY_PAGES` into `website/src/components/ToolPage.tsx` (or wherever `INSTRUCTOR_PAGES`/`CUSTOMER_PAGES` are merged — read that file first and follow its exact merge pattern). In `website/src/App.tsx` add deep routes following the existing `/dashboard/p/...` pattern: `/dashboard/p/courses/:courseId` → CourseDetailPage, `/dashboard/p/courses/:courseId/purchase` → PurchaseSheet, `/dashboard/p/courses/:courseId/learn` → CoursePlayerPage, `/dashboard/p/courses/:courseId/certificate` → CertificatePage, plus the public route `/verify/cert/:certificateId` → VerifyCertificatePage (placed with the other non-dashboard public routes). In `website/src/lib/dashboard.ts` ensure `courses` and `courseDetail` toolIds resolve to these pages (they are already listed in the UNIVERSAL tool list — verify, do not duplicate).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix route/registry wiring only.
- [ ]

### Task 1.18 — Fix certificate-verify endpoint honesty
- DO: Edit `backend/app/routers/teachers.py` function `verify_certificate_public` (currently ~line 493): it must stay unauthenticated (public verify for employers/third parties — instructions.md §WS-01 step 3) but return only real public fields. Delete the second `return` block that fabricates `isValid: True` with made-up names and a random `tamperProofHash` for unknown ids (demo backdoor — global rule 1). New behavior: found purchase → return `{"isValid": True, "certificateId": certificate_id, "recipientName": p.get("studentName"), "courseTitle": p.get("courseTitle"), "issuedAt": p.get("certificateIssuedAt"), "credential": p.get("credential")}` (no PII beyond name — drop `tamperProofHash` entirely); not found → raise the standard error envelope via the file's `_error(404, "CERTIFICATE_NOT_FOUND", "certificate not found")`.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0 (existing suite green; adjust nothing else).
- IF FAIL: read the failing test; if it asserted the fabricated payload, update the test's expectation to the honest contract (never delete the assertion — playbook §3 rule 2) and re-run.
- [ ]

### Task 1.19 — Create test_academy_learner.py: purchase + verify
- DO: Create `backend/tests/test_academy_learner.py` (new) following the fixtures/client patterns of `backend/tests/test_courses.py` (read it first). Cover: (a) enroll free course → `status paid` and `GET /learn` works; (b) paid course enroll → returns `paymentOrderId`, then `POST /v1/courses/purchases/verify` with the suite's Razorpay stub/signature path flips to `purchased: True`; (c) duplicate verify is a no-op (`purchased: True`, no double `salesCount` increment); (d) certificate verify public: known certificate id → 200 with `isValid` true and no `tamperProofHash` key; unknown id → 404 with error envelope code `CERTIFICATE_NOT_FOUND`; (e) `GET /v1/courses` response contains `data` plus pagination fields.
- RUN: backend pytest `tests/test_academy_learner.py -q`
- EXPECT: exit 0, all new tests pass.
- IF FAIL: fix the backend code (not the test) unless the test contradicts an existing passing test — then STOP and report.
- [ ]

### Task 1.20 — Add daily coin earn cap to coins.py
- DO: Edit `backend/app/services/coins.py` `_apply_delta`: when `delta > 0`, enforce a config-driven daily earn cap (X11 — instructions.md §WS-01 step 6). Exact logic inserted before the balance update: `cfg = await get_doc("platform_config", "gamification") or {}`; `cap = int(cfg.get("dailyEarnCap", 200))`; `today = datetime.now(timezone.utc).date().isoformat()`; `entries = await query(f"users/{uid}/coin_ledger", [], limit=1000)`; `earned_today = sum(e.get("amount", 0) for e in entries if e.get("amount", 0) > 0 and str(e.get("at", ""))[:10] == today)`; `allowed = max(0, cap - earned_today)`; `delta = min(delta, allowed)`; if `delta == 0`, return the current balance unchanged without writing ledger docs. Negative deltas (spends) are untouched. Coins never become cash-redeemable — add no cash-out path.
- RUN: backend pytest `tests/test_gamification.py -q`
- EXPECT: exit 0.
- IF FAIL: a gamification test awards >200 coins in a day — adjust the test's fixture to stay under the cap or seed a `platform_config/gamification` doc with a higher `dailyEarnCap` for that test; never weaken the cap logic.
- [ ]

### Task 1.21 — Test the daily earn cap
- DO: Append to `backend/tests/test_academy_learner.py`: award 200 coins to a user via `award_coins` (direct service call as other service-level tests do) → balance increases by 200; award 25 more the same day → balance increases by 0 (capped at 200) and no new ledger entry is written for the second call; then award 150 to a fresh user and a further 100 → only 50 of the second award is applied (balance 200).
- RUN: backend pytest `tests/test_academy_learner.py -q -k daily`
- EXPECT: exit 0.
- IF FAIL: fix `coins.py` cap logic until the test passes; do not edit the test.
- [ ]

### Task 1.22 — Enforce 50%-of-order redemption cap in course enroll
- DO: Edit `backend/app/routers/courses.py` `enroll_course` (currently ~line 384): inside the `body.useCoins and coins_to_redeem > 0` branch, read `cfg = await get_doc("platform_config", "gamification") or {}` and `pct = int(cfg.get("redemptionMaxPctOfOrder", 50))`; compute `pct_cap = int(fee) * pct // 100` (integer math); change the rejection condition to `coins_to_redeem > min(coins_allowed, int(fee), pct_cap)` → `_error(422, "INVALID_COIN_AMOUNT", ...)` with the standard envelope. Keep the existing `spend_coins`/`InsufficientCoins` handling.
- RUN: backend pytest `tests/test_courses.py -q`
- EXPECT: exit 0.
- IF FAIL: an existing test redeems more than 50% — update the test's coin amount to respect the cap (that is the new correct contract per instructions.md §WS-01 step 6) and re-run.
- [ ]

### Task 1.23 — Test over-50% redemption rejected
- DO: Append to `backend/tests/test_academy_learner.py`: course with `priceRupees` 1000 and `coinsDiscountAllowed` 800; user with sufficient coins; `POST /v1/courses/{id}/enroll` with `{useCoins: true, coinsToRedeem: 600}` → 422 and the JSON body contains `"INVALID_COIN_AMOUNT"`; same call with `coinsToRedeem: 500` → accepted (exactly 50% passes).
- RUN: backend pytest `tests/test_academy_learner.py -q -k coin`
- EXPECT: exit 0.
- IF FAIL: fix the `enroll_course` condition (boundary must be inclusive at exactly 50%); do not edit the test.
- [ ]

### Task 1.24 — Build skill passport in profile
- DO: Edit `website/src/App.tsx` and the profile view: replace the `PlaceholderPage` slice at `/dashboard/profile` (currently ~lines 413–417 — read first; if a real profile view has landed, add a section to it instead) with a "Certificates / Skill Passport" section component `website/src/views/academy/SkillPassportSection.tsx` (new): lists earned certificates from `getPurchasedCourses()` filtered to entries with a `certificateId`, each row showing course title, issue date, a QR image of `https://agrovercity.com/verify/cert/{certificateId}`, and a link to the public verify page. Global rule 2: display the linked `farmerId` context — every certificate carries `farmerId` (use the logged-in farmer's id; no hardcoded ids). All strings `t()` en+hi in the academy locale pair.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new component, the profile wiring, and the locale files.
- [ ]

### Task 1.25 — Emit learner tasks on progress and certificate
- PRECONDITION: `grep -rq 'def emit_task' backend/app/ && grep -q 'tasks' backend/app/main.py` — if this fails, phase-01's task engine is missing: STOP the phase (playbook §5).
- DO: Read the phase-01 `emit_task()` signature (`grep -rn 'def emit_task' backend/app/services/`) and follow it exactly. In `backend/app/routers/courses.py` lesson-progress handler (`record_lesson_progress`, ~line 530): after persisting progress, when `progressPercent < 100` call `emit_task(...)` with persona `farmer`, module `courses`, kind `course_progress`, bilingual `title_en`/`title_hi` strings, and `deepLink` `/dashboard/p/courses/{course_id}/learn`; when the progress update flips the purchase to completed and assigns a `certificateId`, also emit kind `certificate_earned` with `deepLink` `/dashboard/p/courses/{course_id}/certificate`. Dedupe-safe per the phase-01 contract (pass `sourceId` = purchase id).
- RUN: backend pytest `tests/test_academy_learner.py -q`
- EXPECT: exit 0.
- IF FAIL: align the `emit_task` kwargs with the real phase-01 signature; do not stub the function.
- [ ]

### Task 1.26 — Emit new-courses and live-class learner tasks
- PRECONDITION: same as task 1.25 (`grep -rq 'def emit_task' backend/app/`).
- DO: Create `backend/app/services/academy_tasks.py` (new) with `async def emit_learner_discovery_tasks(uid: str) -> None`: (a) "new courses matching my crops" — deterministic fallback for WS-06 (instructions.md §WS-01 step 5): read the user doc's crop categories, query `courses` where `status == "published"` and category in the user's crops, sort by `createdAt` descending, take the newest, emit kind `new_courses_for_you` with `deepLink` `/dashboard/p/courses`; skip silently when the user has no crop categories; (b) "class at 5pm" — query `course_batches` for batches of courses the user has a `paid` purchase for, and when a batch's `scheduleDays`/date window includes today, emit kind `live_class_today` with the batch's schedule string and `deepLink` `/dashboard/p/courses`. Call `emit_learner_discovery_tasks(user["id"])` from the `GET /v1/courses/my-learning` handler in `courses.py` (before returning).
- RUN: backend pytest `tests/test_academy_learner.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new service and its call site.
- [ ]

### Task 1.27 — Add learner summary grid items
- PRECONDITION: `grep -rln 'summary' backend/app/routers/tasks.py` — phase-01 summary endpoint must exist; else STOP (playbook §5).
- DO: In the phase-01 tasks summary implementation (`backend/app/routers/tasks.py`, read it first and follow its per-persona summary pattern), add learner summary items for persona `farmer`: `myCoursesProgress` (count of `course_purchases` with `status == "paid"` and `progressPercent < 100`) and `certificatesEarned` (count with a non-null `certificateId`), both deep-linking to `/dashboard/p/courses` and `/dashboard/profile` respectively.
- RUN: backend pytest `tests/test_academy_learner.py -q && .venv/bin/python -m pytest -q -k summary` (cwd `backend/`)
- EXPECT: exit 0 for both.
- IF FAIL: align with the real summary code shape found in `tasks.py`; if `tasks.py` does not exist, STOP (phase-01 gap).
- [ ]

### Task 1.28 — Verify Idempotency-Key support on learner writes
- PRECONDITION: `grep -rn 'Idempotency-Key\|idempotency_key\|IdempotencyKey' backend/app/main.py backend/app/core/ backend/app/services/payments.py` returns at least one match — phase-00's idempotency plumbing must exist; else STOP the phase (playbook §5).
- DO: Append to `backend/tests/test_academy_learner.py`: `POST /v1/courses/{id}/enroll`, `POST /v1/courses/{id}/purchase`, and `POST /v1/courses/{id}/lessons/{lid}/progress` each sent twice with the same `Idempotency-Key` header produce the same result without double-applying (no duplicate purchase doc, no double `salesCount`, progress written once). Use whatever idempotency mechanism phase-00 installed (read the match found by the PRECONDITION first).
- RUN: backend pytest `tests/test_academy_learner.py -q -k idempot`
- EXPECT: exit 0.
- IF FAIL: the phase-00 idempotency plumbing does not cover these routes — STOP and report which route lacks it (do not build a parallel mechanism).
- [ ]

### Task 1.29 — HUMAN CHECK: learner end-to-end flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` both succeed — if not, start the stack with `./run.sh --no-mobile` from the repo root (playbook §3 rule 9) and re-check.
- DO: HUMAN CHECK: a human operator performs, on the running dev stack: (1) from the farmer dashboard, click a learner task deep-link → lands on the course catalog; (2) filter + search for a course; (3) buy it in Razorpay test mode with the coin slider — confirm the slider cannot exceed min(`coinsDiscountAllowed`, 50% of fee, balance); (4) watch lessons in the player, confirm progress persists across reload; (5) reach 100% → open the certificate → scan the QR with a phone → the public verify page shows the certificate while logged out; (6) open `/dashboard/profile` → the certificate appears in the Skill Passport; (7) switch the UI language to Hindi and repeat steps 1–6 confirming no English-only strings and no raw `t()` keys visible.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step works and reports any breakage.
- IF FAIL: record the exact broken step and output, fix the responsible file, re-run the implicated task's check, then repeat this HUMAN CHECK once.
- [ ]

### Task 1.30 — WS-01 checkpoint
- DO: Run the full WS-01 Verification block from instructions.md §WS-01, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-04 WS-01: learner Krishi Academy"`
- EXPECT: pytest fully green; tsc+build clean; commit succeeds (if git identity is missing, note it and continue — playbook §6).
- IF FAIL: fix the reported failure at its source task; do not commit red.
- [ ]

## WS-02 — Instructor console refactor  (see instructions.md §WS-02)

### Task 2.1 — Create instructor locale pair and register it
- DO: Create `website/src/lib/i18n/locales/en.instructor.ts` and `website/src/lib/i18n/locales/hi.instructor.ts` (both new) following the `en.trade.ts` pattern (`registerLocale('en', ...)` / `registerLocale('hi', ...)`). Seed both with: `instructorHomeTitle` ('Instructor Console' / 'प्रशिक्षक कंसोल'), `instructorMyCourses` ('My Courses' / 'मेरे पाठ्यक्रम'), `instructorBatches` ('Batches' / 'बैच'), `instructorEnquiries` ('Enquiries' / 'पूछताछ'), `instructorAssignments` ('Assignments' / 'असाइनमेंट'), `instructorEarnings` ('Earnings' / 'कमाई'), `instructorCredentials` ('Credentials & KYC' / 'क्रेडेंशियल और केवाईसी'). Add `import './lib/i18n/locales/en.instructor';` and `import './lib/i18n/locales/hi.instructor';` to `website/src/main.tsx` after the academy imports.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the new files/imports only.
- [ ]

### Task 2.2 — Create InstructorHome dashboard view
- DO: Create `website/src/views/instructor/InstructorHome.tsx` (new): dashboard summary view binding the instructor dashboard summary grid (task 2.33 fills the data; for now render the summary cards from `GET /v1/teachers/analytics` via the existing `instructorAcademy.ts` wrapper) with links to the six sections. All strings `t()` en+hi (instructor locale pair); no hardcoded strings, no `?? <number>`, no demo data.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 2.3 — Create MyCoursesPage
- DO: Create `website/src/views/instructor/MyCoursesPage.tsx` (new): list from `GET /v1/teachers/courses/mine`; create/edit forms calling `POST /v1/teachers/courses/create` and the `courses.py` CRUD (`PUT /v1/courses/{id}`) via the `instructorAcademy.ts` wrapper (extend the wrapper there if a function is missing — same file conventions). Show each course's `status` and `moderationStatus` via `t()` labels. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file, the wrapper, and locale files.
- [ ]

### Task 2.4 — Create BatchesPage with real QR attendance
- DO: Create `website/src/views/instructor/BatchesPage.tsx` (new): batches from `GET /v1/teachers/batches`; create-batch form (`POST /v1/teachers/batches`); per-batch attendance loading ONLY real session ids derived from the selected batch (session id = the batch's session identifier — never the literal `'sess_demo'`; global rule 1) calling `GET/POST /v1/teachers/sessions/{sessionId}/attendance`. All strings en+hi.
- RUN: website tsc && grep -rn "sess_demo" website/src/views/instructor/BatchesPage.tsx
- EXPECT: tsc exit 0; grep prints nothing (exit 1 from grep is success here).
- IF FAIL: remove the hardcoded session id; load it from the batch object.
- [ ]

### Task 2.5 — Create EnquiriesPage with template quotes
- DO: Create `website/src/views/instructor/EnquiriesPage.tsx` (new): enquiries from `GET /v1/teachers/enquiries`; reply only via structured template cards (fee quote form with `proposedFeeRupees` + `terms` calling `POST /v1/teachers/enquiries/{id}/quote`) — no free-text chat pre-booking (instructions.md §WS-02 step 1). All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 2.6 — Create AssignmentsPage
- DO: Create `website/src/views/instructor/AssignmentsPage.tsx` (new): assignments from `GET /v1/teachers/assignments`; grade form (score/feedback/passed) calling `POST /v1/teachers/assignments/{id}/grade`. Include an empty container for the AI prefill suggestion that WS-06 task 6.9 will populate (render it only when the assignment doc has an `aiSuggestion` field — no placeholder UI, no TODO comments). All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 2.7 — Create EarningsPage
- DO: Create `website/src/views/instructor/EarningsPage.tsx` (new): bind `GET /v1/teachers/earnings`; render the ledger (fees collected − commission = payout) formatting integer paisa client-side, a course/batch-wise breakdown list, the next payout date, and an `onHold` notice when the response says the bank account is unverified (strings via `t()`). No money movement anywhere in this UI (global rule 3); no `?? <number>` fallbacks.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 2.8 — Create CredentialsPage
- DO: Create `website/src/views/instructor/CredentialsPage.tsx` (new): shows the instructor's KYC/credential case status (from the phase-00 KYC endpoints — read `grep -rn 'kyc' website/src/lib/api/` first and reuse that wrapper; if none exists, extend `instructorAcademy.ts` with `getMyKycCase()` and `uploadCredentialDoc(type, file)` against the phase-00 KYC upload endpoints) with upload controls for identity docs (Aadhaar eKYC XML/QR, Voter ID, PAN, DL + liveness selfie) and specialization docs (DGCA Remote Pilot Certificate, degrees, NABARD/NRLM/SRLM empanelment). All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: if no phase-00 KYC endpoint exists to bind, STOP the phase (playbook §5) and report the missing dependency.
- [ ]

### Task 2.9 — Register instructor pages and routes
- DO: Edit `website/src/views/instructor/index.tsx`: point `INSTRUCTOR_PAGES` at the new views — `instructorHome` → `InstructorHome`, plus entries `myCourses`/`batches`/`enquiries`/`assignments`/`earnings`/`credentials` mapped to the new pages. Register any new toolIds in `website/src/lib/dashboard.ts` instructor tool list (keep `instructorHome` as the instructor home). Add deep routes in `website/src/App.tsx` following the existing `/dashboard/p/...` pattern for the parameterized pages.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the registry/route wiring only.
- [ ]

### Task 2.10 — Delete the instructor monolith and sess_demo
- DO: Delete `website/src/views/instructor/InstructorHomeBoard.tsx` (its functionality now lives in the routed views) and remove its import/registration from `website/src/views/instructor/index.tsx`. Then verify zero remaining occurrences of `sess_demo` and zero `?? <hardcoded>` fallbacks in the instructor views (acceptance, instructions.md §WS-02).
- RUN: `grep -rn "sess_demo" website/src/ ; grep -rnE '\?\? [0-9]+' website/src/views/instructor/ ; pnpm exec tsc --noEmit` (last command cwd `website/`)
- EXPECT: both greps print nothing; tsc exit 0.
- IF FAIL: remove the remaining occurrence at its source file; never add a new fallback.
- [ ]

### Task 2.11 — Remove demo seeding: courses/mine
- DO: Edit `backend/app/routers/teachers.py` `list_my_courses` (currently ~lines 258–287): delete the block that seeds the "Precision Agri-Drone Spraying" demo course when the instructor has none (demo backdoor — global rule 1). Return the real (possibly empty) list.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: a test relied on the seeded course — update the test to create its own course fixture via `POST /v1/teachers/courses/create`; never restore the seed.
- [ ]

### Task 2.12 — Remove demo seeding: batches
- DO: Edit `backend/app/routers/teachers.py` `list_teacher_batches` (~lines 322–342): delete the "Default active batch" seeding block. Return the real (possibly empty) list.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: same as 2.11 — give the test its own batch fixture via `POST /v1/teachers/batches`.
- [ ]

### Task 2.13 — Remove demo seeding: enquiries
- DO: Edit `backend/app/routers/teachers.py` `list_teacher_enquiries` (~lines 370–387): delete the demo enquiry seeding block. Return the real list.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: same fixture-adjustment rule as 2.11.
- [ ]

### Task 2.14 — Remove demo seeding: assignments
- DO: Edit `backend/app/routers/teachers.py` `list_practical_assignments` (~lines 452–474): delete the demo assignment seeding block (including the unsplash URL). Return the real list.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: same fixture-adjustment rule as 2.11.
- [ ]

### Task 2.15 — Add courseGMVPct to settlements config
- DO: Edit `backend/app/services/settlements.py`: add `"courseGMVPct": 15` to `DEFAULT_CONFIG`; add a helper `def course_gmv_pct(config: dict, category: str | None = None) -> int` that reads an optional per-category override from `config.get("courseGMVPctByCategory", {})`, falls back to `config.get("courseGMVPct", 15)`, and clamps any value outside the allowed 15–20 range back to 15 (allowed range per instructions.md §WS-02 step 4). Versioning: when `_config()` creates the default doc, also write `version: 1` and `effectiveFrom` (current ISO date) fields.
- RUN: backend pytest `tests/test_admin_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `settlements.py` config handling.
- [ ]

### Task 2.16 — Extend run_settlements for instructor payables
- DO: Edit `backend/app/services/settlements.py` `run_settlements`: add a new bucket role `instructor` keyed by `courseGMVPct`. Query `course_purchases` where `status == "paid"` and `paidAt` within the period; group by `instructorId`; for each instructor compute the pct via `course_gmv_pct(config, course_category)` (look up each purchase's course doc for its category); write settlement docs with the existing shape (`grossRupees`, `commissionRupees`, `netRupees`, `status: "pending"`, `sourceIds`, doc id `st_instructor_{instructorId[:8]}_{period_start}`). Integer math only; every financial mutation also writes an `audit_logs` entry following the repo's existing audit-write pattern (`grep -rn 'audit_logs' backend/app/services/ | head` to find it).
- RUN: backend pytest `tests/test_admin_finance.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `settlements.py`.
- [ ]

### Task 2.17 — Test instructor settlement accrual
- DO: Create `backend/tests/test_instructor_console.py` (new). First test: seed an instructor, a published course, and a `paid` `course_purchases` doc with `paidAt` inside the period and `amountRupees` 1000; run `run_settlements(period_start, period_end)`; assert a settlement doc `st_instructor_...` exists with role `instructor`, `grossRupees` 1000, `commissionRupees` between 150 and 200 inclusive (15–20%), `netRupees` = gross − commission. Second test: `course_gmv_pct` clamps a configured 25 down into range and honors a per-category override of 20.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `settlements.py`; do not weaken the assertions.
- [ ]

### Task 2.18 — Hand instructor settlements to TDS and payout rails
- PRECONDITION: `grep -rq 'tds_ledger' backend/app/ && grep -rq 'razorpayx\|bank_verify' backend/app/services/` — phase-00's TDS 194-O ledger and RazorpayX payout rails must exist; else STOP the phase (playbook §5).
- DO: In `backend/app/services/settlements.py` `run_settlements`, for each instructor settlement doc written: (a) write a `tds_ledger` entry using the phase-00 TDS helper/shape found by the PRECONDITION grep (fields `{txnId, persona: "instructor", grossPaisa, tdsPaisa, section: "194-O", period}` — gross/net converted to integer paisa); (b) set the settlement doc `onHold: True` when the instructor user doc lacks a verified bank account per the phase-00 bank-verify marker (read the bank_verify service to find the field name; use it verbatim). No money movement outside these rails (global rule 3).
- RUN: backend pytest `tests/test_instructor_console.py -q && .venv/bin/python -m pytest -q -k "tds or payout"` (cwd `backend/`)
- EXPECT: exit 0 for both.
- IF FAIL: align field names with the actual phase-00 helpers; if the helpers don't exist, STOP (phase-00 gap).
- [ ]

### Task 2.19 — Rebuild GET /teachers/earnings on real config
- DO: Edit `backend/app/routers/teachers.py` `get_instructor_earnings` (~line 519): delete the hardcoded `0.10` float commission. Recompute from `course_purchases` where `instructorId == user["id"]` and `status == "paid"`: `grossPaisa = sum(int(round(p["amountRupees"] * 100)))`, `commissionPaisa = grossPaisa * pct // 100` with `pct` from `course_gmv_pct(config)` (import from `services/settlements.py`), `netPaisa = grossPaisa - commissionPaisa`. Return `{grossPaisa, commissionPaisa, netPaisa, currency: "INR", commissionPct: pct, byCourse: [...per-course breakdown with courseId/courseTitle/grossPaisa/netPaisa...], nextPayoutDate, onHold}` where `nextPayoutDate` is the next weekly settlement run date (next Monday, ISO date string) and `onHold` mirrors the bank-verification rule from task 2.18. Integer paisa everywhere (global rule 3/6).
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: update stale response-shape assertions in the test to the new contract (keep equivalent coverage); fix the endpoint until green.
- [ ]

### Task 2.20 — Seed instructor_pro billing plan
- PRECONDITION: `test -f backend/app/services/billing.py && grep -q 'def require_entitlement' backend/app/services/billing.py` — phase-00 billing must exist; else STOP the phase (playbook §5).
- DO: Read `backend/app/services/billing.py` to find how plans are registered/seeded, then add the plan `instructor_pro` with price ₹499/month (`pricePaisa: 49900`, `interval: "month"`, `persona: "instructor"`) and entitlements `{unlimited_courses: true, analytics_full: true, featured_placement: true}` using that file's own plan-registration mechanism (seed function or plan doc — follow the existing convention exactly).
- RUN: backend pytest `-q -k billing`
- EXPECT: exit 0.
- IF FAIL: align with the real billing module shape; if `billing.py` doesn't exist, STOP (phase-00 gap).
- [ ]

### Task 2.21 — Enforce Free=1-course entitlement on create
- DO: In `backend/app/routers/teachers.py` `create_course` and `backend/app/routers/courses.py` `create_course` (the `POST /v1/courses` handler): before creating, apply the phase-00 `require_entitlement` pattern for feature `unlimited_courses`, persona `instructor` (read `services/billing.py` for the exact dependency/helper signature). When the instructor is NOT entitled and already owns 1 course with `status` in `("published", "pending_review")`, reject with the standard error envelope: 402 or 403 (whichever the billing helper emits) with code `ENTITLEMENT_REQUIRED`. Entitled (`instructor_pro`) instructors pass through.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: match the billing helper's real API; do not hand-roll a parallel entitlement check if the helper exists.
- [ ]

### Task 2.22 — Test the entitlement gate
- DO: Append to `backend/tests/test_instructor_console.py`: a non-Pro instructor creates one course (201), then creating a 2nd course fails with 402/403 and a JSON body containing `"ENTITLEMENT_REQUIRED"`; after granting the `instructor_pro` entitlement in the test fixture (use the billing service's own grant/subscribe path), the same create call returns 201.
- RUN: backend pytest `tests/test_instructor_console.py -q -k entitlement`
- EXPECT: exit 0.
- IF FAIL: fix the gate code; do not edit the test.
- [ ]

### Task 2.23 — Gate analytics full view behind Pro
- DO: Edit `backend/app/routers/teachers.py` `GET /analytics` handler: when the instructor lacks the `analytics_full` entitlement, return only the basic subset `{coursesCount, studentsCount}`; entitled instructors receive the existing full payload. Same `require_entitlement` mechanism as task 2.21.
- RUN: backend pytest `tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: update the test fixture to grant the entitlement where the full payload is asserted.
- [ ]

### Task 2.24 — Set moderationStatus on new courses
- DO: Edit `backend/app/routers/teachers.py` `create_course` and `backend/app/routers/courses.py` `create_course`: add field `moderationStatus: "pending_review"` to the new course doc (the phase-07 module-27 admin queue will consume it; no admin UI in this phase). Keep the existing `status` lifecycle unchanged so the learner purchase flow keeps working.
- RUN: backend pytest `tests/test_courses.py tests/test_saas_teachers.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the two handlers only.
- [ ]

### Task 2.25 — Show upgrade prompt on entitlement denial
- DO: Edit `website/src/views/instructor/MyCoursesPage.tsx`: when course create fails with code `ENTITLEMENT_REQUIRED`, render an upgrade-prompt panel (strings `instructorUpgradeTitle`/`instructorUpgradeBody`/`instructorUpgradeCta` in en+hi) whose CTA deep-links to the phase-00 billing/subscription screen for `instructor_pro` (find the route with `grep -rn 'billing\|subscription' website/src/App.tsx`; if no billing screen route exists, link the closest existing settings/billing screen and note it in the session report). No `alert()`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the page and locale files only.
- [ ]

### Task 2.26 — Extend KYC matrix for instructor specializations
- PRECONDITION: `grep -rln 'kyc_cases' backend/app/` finds the phase-00 KYC pipeline files; else STOP the phase (playbook §5).
- DO: Locate the phase-00 KYC document matrix (run `grep -rn 'doc.*matrix\|requiredDocs\|DOCUMENT_MATRIX' backend/app/services/ backend/app/routers/ | head` and read the file it names). Extend it with persona `instructor`: identity = any one of `aadhaar_ekyc`, `voter_id`, `pan`, `driving_licence`, plus mandatory `liveness_selfie`; specialization docs map: `drone_training` → required `dgca_remote_pilot_certificate` (RPTO-issued), `degree_claimed` → required `degree_certificate`, `scheme_literacy_fpo` → required `nabard_nrlm_srlm_empanelment` (marked `conditional: true`); each entry carries `slaHours: 48` and an `expiresAt`-capable `licenceExpiryField`. Follow the matrix's existing entry shape exactly.
- RUN: backend pytest `-q -k kyc`
- EXPECT: exit 0.
- IF FAIL: if no matrix file exists, STOP (phase-00 gap); otherwise fix the new entries to match the existing shape.
- [ ]

### Task 2.27 — Block publish/bookings until KYC approved
- DO: Add a guard in `backend/app/routers/teachers.py` `create_course` and `backend/app/routers/courses.py` `create_course`, plus `backend/app/routers/teachers.py` `create_teacher_batch`: look up the instructor's latest `kyc_cases` doc; unless its status is the phase-00 "approved" value (read the KYC service for the exact status string), reject with 403 and envelope code `KYC_NOT_APPROVED`. Instructors may still browse (GET endpoints stay open).
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: give the test fixtures an approved kyc_cases doc via the phase-00 helper; keep the guard.
- [ ]

### Task 2.28 — Test DGCA specialization publish gate
- DO: Append to `backend/tests/test_instructor_console.py`: an instructor whose KYC case declares specialization `drone_training` but lacks a verified `dgca_remote_pilot_certificate` doc gets 403 with `"KYC_NOT_APPROVED"` on `POST /v1/teachers/courses/create`; after the case carries the verified DGCA doc, the same call returns 201.
- RUN: backend pytest `tests/test_instructor_console.py -q -k kyc`
- EXPECT: exit 0.
- IF FAIL: fix the guard/matrix wiring; do not edit the test.
- [ ]

### Task 2.29 — Add licence-expiry re-verification job
- DO: Edit `backend/app/routers/jobs.py` (read it first, follow its existing job pattern): add `async def reverify_expired_instructor_licences() -> dict` — scan `kyc_cases` for instructor cases whose credential docs carry a `licenceExpiry` date earlier than today and whose status is approved; flip those cases to the phase-00 "needs re-verification" status value and write an `audit_logs` entry per flip with reason `licence_expired`. Register it alongside the file's other scheduled jobs. Return `{reverted: <count>}`.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: match `jobs.py`'s registration convention; do not create a parallel scheduler.
- [ ]

### Task 2.30 — Test licence expiry re-verification
- DO: Append to `backend/tests/test_instructor_console.py`: seed an approved instructor KYC case whose DGCA doc has `licenceExpiry` yesterday; call the job; assert the case status flipped to the re-verification value and an `audit_logs` doc with reason `licence_expired` exists; seed a second case expiring tomorrow and assert it is untouched.
- RUN: backend pytest `tests/test_instructor_console.py -q -k expiry`
- EXPECT: exit 0.
- IF FAIL: fix the job; do not edit the test.
- [ ]

### Task 2.31 — Expose instructor credentials on course detail
- DO: Edit `backend/app/routers/courses.py` `GET /courses/{course_id}` handler: add an `instructorCredentials` array to the response — for each verified credential doc on the instructor's approved KYC case, an entry `{type, verifiedAt}` (types such as `dgca_remote_pilot_certificate`, `degree_certificate`, `nabard_nrlm_srlm_empanelment`). Empty array when none. No PII in this array. This feeds the WS-01 badge slots (tasks 1.10/1.11).
- RUN: backend pytest `tests/test_courses.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the handler only.
- [ ]

### Task 2.32 — Add instructor dashboard summary items
- PRECONDITION: `grep -rq 'def emit_task' backend/app/ && test -f backend/app/routers/tasks.py` — phase-01 engine; else STOP (playbook §5).
- DO: In the phase-01 summary implementation (`backend/app/routers/tasks.py`, follow its pattern), add instructor-persona summary items computed from real collections: `enrollmentsThisWeek` (paid `course_purchases` for this instructor with `paidAt` in the last 7 days), `liveClassesToday` (`course_batches` of this instructor whose schedule covers today), `pendingAssignmentReviews` (`course_assignments` with `status == "submitted"`), `enquiriesAwaitingReply` (`course_enquiries` with `status == "pending"`), `earningsNextPayout` (from the task-2.19 earnings computation), `courseRating` (average `ratingAverage` across the instructor's courses). Emit matching `emit_task` items for the actionable ones (pending reviews, awaiting enquiries) with deepLinks to the new instructor routes.
- RUN: backend pytest `-q -k "summary or instructor"`
- EXPECT: exit 0.
- IF FAIL: align with the real summary/task code shape; if missing, STOP (phase-01 gap).
- [ ]

### Task 2.33 — Write dated deferral note: course moderation queue
- DO: Append to `missing-features/robust.md` under the §6.8 (Instructor) entry a dated deferral note per rule 10 (pattern: phase-01 instructions.md §deferral): today's date, noting the admin course-moderation queue is deferred to phase-07 module 27, and that this phase marks new courses with `moderationStatus: "pending_review"` for it.
- RUN: `grep -n 'pending_review' missing-features/robust.md | head -2`
- EXPECT: at least one match printed.
- IF FAIL: re-open the file and place the note under the correct §6.8 heading.
- [ ]

### Task 2.34 — Add chat moderation helper and strike ladder
- DO: Edit `backend/app/services/chat.py` — append: `PHONE_RE = re.compile(r"(\+91[\-\s]?)?[6-9]\d{9}")`, `UPI_RE = re.compile(r"[\w.\-]{2,}@[a-zA-Z]{2,}")`, `URL_RE = re.compile(r"(https?://|www\.)")`; `def contains_banned_content(text: str) -> str | None` returning `"phone"`/`"upi"`/`"url"` on first match else `None`; `async def record_strike(uid: str, surface: str, reason: str) -> dict` which appends a strike doc to `users/{uid}/strikes` (`{id, surface, reason, at}` ISO), counts total strikes, and applies the ladder (global rule 4): 1 → `warning` (no field change), 2 → set user `chatMutedUntil` = now + 24h ISO, 3 → set user `bookingRestricted: True`, ≥4 → set user `suspended: True`; returns `{strikes, action}`.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `services/chat.py`.
- [ ]

### Task 2.35 — Add batch chat room kind
- DO: Edit `backend/app/services/chat.py` — append `async def ensure_batch_room(batch: dict, member_ids: list[str]) -> dict`: creates/returns a `chat_rooms` doc `{id: batch["id"], kind: "batch", batchId, instructorId, memberIds, sealed: False, createdAt}` following the file's existing room-shape style. Edit `backend/app/routers/chat.py` `_load_room`: add a `batch` branch — load the room directly; authorize when `uid == room["instructorId"] or uid in room.get("memberIds", [])` else 403 `CHAT_LOCKED_FOR_BOOKING`; refresh `memberIds` from `course_purchases` (`status == "paid"`) for the batch's course so only CONFIRMED enrollments can read; `terminal` when the batch doc status is `completed` or the room is `sealed`.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the two files.
- [ ]

### Task 2.36 — Enforce batch chat posting rules
- DO: Edit `backend/app/routers/chat.py` message-post handler (read it first): for rooms with `kind == "batch"` — (a) if the room is `sealed`, reject 409 `ROOM_SEALED`; (b) only `room["instructorId"]` may post (broadcast-only, one-to-many): farmers get 403 `BATCH_BROADCAST_ONLY`; (c) reject non-empty `imageUrl` with 422 `ATTACHMENT_NOT_ALLOWED` (no voice notes/files in batch chat); (d) run `contains_banned_content(text)` — on a match, call `record_strike(uid, "batch_chat", <category>)` and reject 422 `MODERATION_BLOCKED`; (e) if the user doc's `chatMutedUntil` is in the future, reject 429 `CHAT_MUTED`; (f) allow an optional `lessonCardId` field that must reference a real doc in the course's modules/lessons for the batch's course (404 `LESSON_CARD_NOT_FOUND` otherwise) — text + lesson cards are the only message types.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `routers/chat.py`.
- [ ]

### Task 2.37 — Block farmer↔farmer direct chats
- DO: Edit `backend/app/routers/chat.py` `open_direct_chat`: after resolving the counterparty user, if both the caller and the counterparty have `activeProfile == "farmer"`, reject with 403 and envelope code `FARMER_DM_BLOCKED` (instructions.md §WS-02 step 7: farmers cannot DM each other). Other persona pairs are unaffected.
- RUN: backend pytest `-q -k chat`
- EXPECT: exit 0.
- IF FAIL: if an existing test opens a farmer↔farmer direct chat, update the fixture so the counterparty is a non-farmer persona; keep the guard.
- [ ]

### Task 2.38 — Test chat guardrails
- DO: Append to `backend/tests/test_instructor_console.py`: (a) farmer→farmer `POST /v1/chat/direct` → 403 `"FARMER_DM_BLOCKED"`; (b) posting to a batch room as an enrolled farmer → 403 `"BATCH_BROADCAST_ONLY"`; (c) posting to a batch room as a user without a confirmed (`paid`) enrollment → 403 `"CHAT_LOCKED_FOR_BOOKING"`; (d) instructor posts a message containing `9876543210` → 422 `"MODERATION_BLOCKED"` and a strike doc exists under `users/{uid}/strikes`; (e) second banned message sets `chatMutedUntil` on the user doc.
- RUN: backend pytest `tests/test_instructor_console.py -q -k chat_guard`
- EXPECT: exit 0.
- IF FAIL: fix the router/service code; do not edit the test.
- [ ]

### Task 2.39 — Add dispute seal and instructor-no-show outcome
- DO: Edit `backend/app/services/chat.py` — append `async def seal_room_for_dispute(room_id: str, dispute_id: str) -> dict`: sets `sealed: True`, `sealedByDispute: dispute_id`, `sealedAt` on the room and returns it (frozen evidence snapshot — messages stay readable, posting blocked by task 2.36). Append `async def resolve_batch_dispute(room_id: str, outcome: str, *, order_id: str | None = None) -> dict`: for outcome `instructor_no_show`, call the phase-00 refund path in `services/payments.py` (`grep -n 'def refund' backend/app/services/payments.py` — use that exact function) for the full order amount back to source, call `record_strike(room["instructorId"], "dispute", "instructor_no_show")`, and write an `audit_logs` entry; return `{refunded: True}`. Unknown outcomes → raise `ValueError`.
- RUN: backend pytest `tests/test_instructor_console.py -q`
- EXPECT: exit 0.
- IF FAIL: if `payments.py` has no refund function, STOP the phase (phase-00 gap) and report.
- [ ]

### Task 2.40 — Create minimal batch chat view
- DO: Create `website/src/views/instructor/BatchChatView.tsx` (new) and embed it in `BatchesPage` (per selected batch): instructor broadcast compose box (text + optional lesson-card picker listing the batch course's lessons), read-only message list for the batch room via the existing `website/src/lib/api/chat.ts` wrapper (extend it there with `getBatchRoom(batchId)` / `postBatchMessage(roomId, text, lessonCardId?)` if missing). No attachment/voice UI. All strings en+hi (instructor locale pair).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new view, BatchesPage, the wrapper, and locale files.
- [ ]

### Task 2.41 — HUMAN CHECK: instructor day flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed (else start with `./run.sh --no-mobile`).
- DO: HUMAN CHECK: on the dev stack (1) open the instructor dashboard → click a summary task → reply to an enquiry using a template quote card; (2) open Batches → mark QR attendance for a real session; (3) grade a submitted assignment; (4) open Earnings → confirm the accrual from the test purchase, the 15–20% commission line, and the payout status/next payout date; (5) open Credentials → confirm KYC status renders; (6) repeat in Hindi, confirming no English-only strings.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step.
- IF FAIL: record the broken step, fix the responsible file, re-run its task check, repeat this HUMAN CHECK once.
- [ ]

### Task 2.42 — WS-02 checkpoint
- DO: Run the full WS-02 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `grep -rn "sess_demo" website/src/ ; git add -A && git commit -m "phase-04 WS-02: instructor console refactor"`
- EXPECT: pytest green; tsc+build clean; grep prints nothing; commit succeeds (identity issues: note and continue — playbook §6).
- IF FAIL: fix the failure at its source task; do not commit red.
- [ ]

## WS-03 — e-Market Customer 'FarmGate'  (see instructions.md §WS-03)

### Task 3.1 — Create emarket locale pair and register it
- DO: Create `website/src/lib/i18n/locales/en.emarket.ts` and `website/src/lib/i18n/locales/hi.emarket.ts` (both new) following the `en.trade.ts` pattern. Seed both with: `emarketHomeTitle` ('FarmGate — Buy Fresh' / 'फार्मगेट — ताज़ा खरीदें'), `emarketBrowse` ('Browse Produce' / 'उपज ब्राउज़ करें'), `emarketDemands` ('My Demands' / 'मेरी माँगें'), `emarketQuotes` ('Quotes' / 'कोटेशन'), `emarketOrders` ('Orders' / 'ऑर्डर'), `emarketFavorites` ('Favorite Farmers' / 'पसंदीदा किसान'), `emarketInspection` ('Inspection' / 'निरीक्षण'). Add both imports to `website/src/main.tsx` after the instructor imports.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the new files/imports only.
- [ ]

### Task 3.2 — Create EMarketHome dashboard view
- DO: Create `website/src/views/customer/EMarketHome.tsx` (new): customer dashboard summary binding `GET /v1/customer/analytics` via the existing `website/src/lib/api/emarketCustomer.ts` wrapper, with links to Browse/Demands/Quotes/Orders/Favorites. All strings `t()` en+hi (emarket pair); no `?? <number>` fallbacks; no hardcoded strings.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 3.3 — Create BrowsePage
- DO: Create `website/src/views/customer/BrowsePage.tsx` (new): produce-near-me listing calling the new `GET /v1/customer/browse/near-me` endpoint (task 3.12 adds it — add `browseNearMe(lat, lng, crop?)` to `emarketCustomer.ts` in this task) with rank toggles for price, distance, grade match, rating, freshness; each lot card shows farmer name, price, distance km, grade, rating, and a freshness chip derived from `harvestDate` (chip labels via `t()`; freshness = days since harvest — per S3, instructions.md §WS-03 step 2). Every card links to the farmer storefront. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file, the wrapper, and locale files.
- [ ]

### Task 3.4 — Create StorefrontPage
- DO: Create `website/src/views/customer/StorefrontPage.tsx` (new): reads `:farmerId` from the route; loads the farmer storefront (`GET /v1/customer/storefronts/{farmerId}` — task 3.13; add `getStorefront(farmerId)` to `emarketCustomer.ts` here); renders all available lots from that farmer, farmer rating, and credentials. Global rule 2: `farmerId` linkage is displayed on every lot/quote the page produces. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and the wrapper.
- [ ]

### Task 3.5 — Create DemandsPage
- DO: Create `website/src/views/customer/DemandsPage.tsx` (new): demands list `GET /v1/customer/demands`, create form `POST /v1/customer/demands`, delete action `DELETE /v1/customer/demands/{id}` — all via the existing `emarketCustomer.ts` wrapper. All strings en+hi; no `?? <number>`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and wrapper.
- [ ]

### Task 3.6 — Create QuotesPage
- DO: Create `website/src/views/customer/QuotesPage.tsx` (new): quotes list `GET /v1/customer/quotes`; per-quote detail showing the `fairPriceBand` field (min/max unit price band — task 3.16) when present; counter-offer form calling `POST /v1/customer/quotes/{qid}/counter` showing the remaining counter rounds (`counterRounds` of 3) and the `priceLockUntil` timer; accept button calling `POST /v1/customer/quotes/{qid}/accept` (task 3.14) which surfaces the deposit-escrow requirement when the quote is high-value. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file, wrapper, and locale files.
- [ ]

### Task 3.7 — Create OrdersPage
- DO: Create `website/src/views/customer/OrdersPage.tsx` (new): orders list `GET /v1/customer/orders`; parent orders expand into their child orders (`parentOrderId`) with a per-shipment status timeline and a QR-handover action per child (`POST /v1/customer/orders/{oid}/qr-handover`); each line shows its logistics mode (`farmer_delivery` / `customer_pickup` / `platform_transport`). This is the page the `orderTracking` toolId resolves to. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and wrapper.
- [ ]

### Task 3.8 — Create InspectionPage
- DO: Create `website/src/views/customer/InspectionPage.tsx` (new): for a delivered order, a photo-evidence inspection form — damage percentage slider, grade-match yes/no, photo URL upload inputs — calling `POST /v1/customer/orders/{oid}/inspection`; renders the outcome (normal settlement / pro-rata deduction / dispute) from the response. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and wrapper.
- [ ]

### Task 3.9 — Create FavoritesPage with subscriptions
- DO: Create `website/src/views/customer/FavoritesPage.tsx` (new): favorite suppliers via `GET/POST /v1/customer/suppliers/favorites`; subscription/standing-demand section (C2) — form with crop, grade, qty, target price band (min/max), delivery window, and frequency (`daily`/`weekly`/`seasonal`) over the selected favorite farmers, calling the subscription endpoints from task 3.27 (`getSubscriptions`/`createSubscription`/`deleteSubscription` added to `emarketCustomer.ts` in this task). Render existing subscriptions with their next run date. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file, wrapper, and locale files.
- [ ]

### Task 3.10 — Register customer pages, delete monolith
- DO: Edit `website/src/views/customer/index.tsx`: point `CUSTOMER_PAGES` at the new views — `emarketHome` → `EMarketHome`, `browse` → `BrowsePage`, `storefront` → `StorefrontPage`, `demands` → `DemandsPage`, `quotes` → `QuotesPage`, `orderTracking` → `OrdersPage`, `inspection` → `InspectionPage`, `favorites` → `FavoritesPage`. Register any new toolIds in `website/src/lib/dashboard.ts` (customer tools already list `emarketHome`, `marketplace`, `orderTracking`, `addressBook`, `myBookings`, `liveChannels` — keep those, add the new ones). Add deep routes in `website/src/App.tsx` for parameterized pages (`/dashboard/p/storefront/:farmerId`, `/dashboard/p/orders/:orderId/inspect`). Delete `website/src/views/customer/CustomerHomeBoard.tsx` and its import. Verify all 9 `?? <hardcoded>` fallbacks are gone with it.
- RUN: `grep -rnE '\?\? [0-9]+' website/src/views/customer/ ; pnpm exec tsc --noEmit` (second command cwd `website/`)
- EXPECT: grep prints nothing; tsc exit 0.
- IF FAIL: remove remaining fallbacks at the source; never add new ones.
- [ ]

### Task 3.11 — Add haversine to geo service
- DO: Edit `backend/app/services/geo.py` — append `def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float` (standard haversine, earth radius 6371.0 km) and `def freshness_days(harvest_date: str | None) -> int | None` returning whole days between an ISO `harvestDate` and today (None when unparseable — callers skip, never default to a number).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `geo.py`.
- [ ]

### Task 3.12 — Add produce-near-me endpoint
- DO: Edit `backend/app/routers/emarket_customer.py` — add `GET /browse/near-me` (params `lat: float`, `lng: float`, `crop: str | None = None`, `radiusKm: float = 50`, `page`, `pageSize`): query available produce lots (read `backend/app/routers/lots.py` for the collection name and available-status value; use them verbatim), exclude lots without `latitude`/`longitude`, compute `distanceKm` via `haversine_km`, filter to radius, and rank by the request's `sort` param (`price` | `distance` | `grade` | `rating` | `freshness`, default `distance`; freshness sorts by `harvestDate` descending). Each item: `{lotId, farmerId, farmerName, crop, grade, qtyAvailable, pricePaisa, distanceKm, harvestDate, freshnessDays, farmerRating}`. Integer paisa; standard pagination envelope; global rule 2 farmerId linkage on every item.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handler.
- [ ]

### Task 3.13 — Add farmer storefront endpoint
- DO: Edit `backend/app/routers/emarket_customer.py` — add `GET /storefronts/{farmer_id}`: all available lots from that `farmerId`, plus `{farmerId, farmerName, farmerRating, credentials: [...verified credential types from the farmer's KYC case if the phase-00 KYC pipeline exposes them, else an empty array...]}`. 404 envelope `FARMER_NOT_FOUND` when the farmer user doc doesn't exist.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handler.
- [ ]

### Task 3.14 — Add binding-quote accept with deposit escrow
- PRECONDITION: `grep -rq 'escrowStatus\|def.*escrow' backend/app/services/ backend/app/routers/purchases.py` — phase-00 escrow rails must exist; else STOP the phase (playbook §5).
- DO: Edit `backend/app/routers/emarket_customer.py` — add `POST /quotes/{quote_id}/accept` (accepts `Idempotency-Key`): load the quote; if expired (`expiresAt` past) → 410 `QUOTE_EXPIRED`; compute `orderValuePaisa`; read `emarketDepositPct` (default 20) and `emarketHighValueThresholdPaisa` (default 1000000) from `platform_config/settlements` (extend `services/settlements.py::_config` consumers the same way — add both keys to `DEFAULT_CONFIG` in `services/settlements.py`); when `orderValuePaisa >= threshold`, create the deposit via the phase-00 escrow path found by the PRECONDITION (`depositPaisa = orderValuePaisa * pct // 100`, integer math) and set the resulting order doc `escrowStatus` per the phase-00 convention; create the `customer_orders` doc(s) with status `deposit_pending` → `confirmed` on escrow funding; refunds on cancellation go to source via the phase-00 refund path. Every financial mutation writes `audit_logs` (global rule 3).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: align with the real phase-00 escrow helper names; if none exist, STOP (phase-00 gap).
- [ ]

### Task 3.15 — Test deposit escrow math
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: quote worth ₹20,000 (2,000,000 paisa) with default config → accept creates an escrow/deposit record of exactly 400,000 paisa (20%) and an order whose `escrowStatus` is the funded state; quote worth ₹5,000 → no deposit required, order confirms directly; repeat accept with the same `Idempotency-Key` → no duplicate order/escrow.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k escrow`
- EXPECT: exit 0.
- IF FAIL: fix the accept handler; do not edit the test.
- [ ]

### Task 3.16 — Add fair-price band service
- DO: Create `backend/app/services/fair_price.py` (new) with `async def fair_price_band(crop: str, district: str) -> dict`: query `customer_orders` with status `delivered` and `deliveredAt` within the last 90 days for the crop+district; collect their per-unit prices (integer paisa); return `{crop, district, minUnitPaisa: <min>, maxUnitPaisa: <max>, sampleSize: <n>}` — or `sampleSize: 0` with null band when no history (no invented numbers). Edit `backend/app/routers/emarket_customer.py`: include `fairPriceBand` in each quote object returned by `GET /quotes` and in counter-offer responses (C5 display requirement).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new service and the quote serializers.
- [ ]

### Task 3.17 — Test fair-price band presence
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: seed two delivered orders for crop `tomato` district `nashik` at unit prices 2,000 and 3,000 paisa; `GET /v1/customer/quotes` items for that crop/district carry `fairPriceBand` with `minUnitPaisa: 2000`, `maxUnitPaisa: 3000`, `sampleSize: 2`; a crop with no history yields `sampleSize: 0`.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k band`
- EXPECT: exit 0.
- IF FAIL: fix the service; do not edit the test.
- [ ]

### Task 3.18 — Cap counter rounds and add quote timers
- DO: Edit `backend/app/routers/emarket_customer.py` `counter_quote` (`POST /quotes/{qid}/counter`): on quote create (in `create_quote`) stamp `counterRounds: 0`, `expiresAt` = now + 24h, and `priceLockUntil` = now + `emarketPriceLockMinutes` (new `platform_config/settlements` key, default 30 — add to `DEFAULT_CONFIG` in `services/settlements.py`). In the counter handler: expired quote → 410 `QUOTE_EXPIRED`; `counterRounds >= 3` → 422 `COUNTER_ROUND_CAP` with the response also carrying `bandNudge: true` and the `fairPriceBand` (E8 deadlock nudge); otherwise increment `counterRounds`, reset `priceLockUntil`, and include the band in the response.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only these handlers.
- [ ]

### Task 3.19 — Test the 3-round counter cap
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: on one quote, three counter calls succeed (rounds 1–3); the fourth → 422 with `"COUNTER_ROUND_CAP"` and `bandNudge: true` in the body.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k counter`
- EXPECT: exit 0.
- IF FAIL: fix the counter handler; do not edit the test.
- [ ]

### Task 3.20 — Add anti-hoarding quantity caps
- DO: Edit `backend/app/routers/emarket_customer.py`: on order creation (in the quote-accept handler from task 3.14 and the cart checkout from task 3.25), read `emarketMaxQtyPerCrop` (map `{crop: maxQtyUnits}`) from `platform_config/settlements` (add `{}` default to `DEFAULT_CONFIG`); when the requested qty for a crop exceeds the buyer's cap → 422 `HOARDING_CAP` with the standard envelope. Surge handling (E9): read `emarketSurgeMode` (default `false`); when true, stamp the order doc `surgeSurchargeDisclosed: true` so invoices disclose the spike surcharge — surge caps commission, never price (do not raise any price field).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the order-creation paths.
- [ ]

### Task 3.21 — Test hoarding cap rejection
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: seed `platform_config/settlements` with `emarketMaxQtyPerCrop: {"onion": 100}`; an order for 150 units of onion → 422 with `"HOARDING_CAP"`; an order for 100 units → succeeds.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k hoarding`
- EXPECT: exit 0.
- IF FAIL: fix the cap check (boundary inclusive); do not edit the test.
- [ ]

### Task 3.22 — Implement inspection damage matrix
- DO: Edit `backend/app/routers/emarket_customer.py` `submit_inspection` (`POST /orders/{oid}/inspection`): body gains `damagePct: int` (0–100), `gradeMatch: bool`, `photoUrls: list[str]`. Enforce E7: inspection allowed only within 72h of `deliveredAt` → else 422 `INSPECTION_WINDOW_EXPIRED`. Damage matrix E5 (integer paisa): `damagePct <= 5` → normal settlement (`inspectionOutcome: "normal"`); `5 < damagePct <= 20` → pro-rata deduction `deductionPaisa = orderValuePaisa * damagePct // 100`, `inspectionOutcome: "pro_rata"`; `damagePct > 20` or `gradeMatch == false` → `inspectionOutcome: "dispute"`, order status `disputed`, freeze the escrow (`escrowStatus: "frozen"` via the phase-00 escrow convention). On acceptance outcomes (`normal`/`pro_rata`), trigger escrow release via the phase-00 release path (deposit release on inspection acceptance / QR handover — instructions.md §WS-03 step 3).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the inspection handler.
- [ ]

### Task 3.23 — Test inspection matrix math
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: order worth 1,000,000 paisa delivered 1h ago — (a) `damagePct: 5` → outcome `normal`, no deduction; (b) `damagePct: 10` → outcome `pro_rata`, `deductionPaisa: 100000`; (c) `damagePct: 21` → outcome `dispute`, order `disputed`, escrow frozen; (d) `damagePct: 3` with `gradeMatch: false` → `dispute`; (e) inspection 73h after delivery → 422 `"INSPECTION_WINDOW_EXPIRED"`.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k inspection`
- EXPECT: exit 0.
- IF FAIL: fix the handler math; do not edit the test.
- [ ]

### Task 3.24 — Implement cancellation penalty matrix
- DO: Edit `backend/app/routers/emarket_customer.py` — add `POST /orders/{order_id}/cancel` (accepts `Idempotency-Key`; writes `audit_logs`): the caller's identity vs the order's `farmerId`/`customerId` decides the rule — E1 farmer cancel: within 2h of order creation free; later → penalty `2% of orderValuePaisa` (integer) recorded in a new `emarket_penalties` doc `{orderId, role: "farmer", pct: 2, amountPaisa, appliedTo: "future_payout", createdAt}` and the order's lots auto-relisted (status back to available). E2 customer cancel: within 4h free; 4–24h → 5% penalty; under 2h to the pickup window → 10% penalty; penalty amount goes to farmer compensation (credit doc on the order: `farmerCompensationPaisa`), the remainder of any prepaid amount refunded to source via the phase-00 refund path. E3 farmer no-show: add `POST /orders/{order_id}/no-show` — auto-cancels the order, calls `record_strike(farmerId, "emarket", "farmer_no_show")` (task 2.34 helper), records a 10% fee in `emarket_penalties` with `appliedTo: "customer_credit"` and sets `customerCreditPaisa` on the order. Unknown caller role → 403 envelope.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handlers.
- [ ]

### Task 3.25 — Test cancellation penalty math
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: order worth 1,000,000 paisa created 3h ago — farmer cancel → `emarket_penalties` doc with `pct: 2`, `amountPaisa: 20000`, `appliedTo: "future_payout"`, and the lot relisted; a second order created 5h ago — customer cancel → 5% (`amountPaisa: 50000`) with `farmerCompensationPaisa: 50000` on the order; farmer no-show on a third order → order cancelled, a strike exists for the farmer, penalty `pct: 10` with `appliedTo: "customer_credit"`. All amounts asserted in integer paisa.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k penalty`
- EXPECT: exit 0.
- IF FAIL: fix the handlers; do not edit the test.
- [ ]

### Task 3.26 — Add WORM evidence service
- DO: Create `backend/app/services/worm.py` (new): `EVIDENCE_ROOT = "backend/.local_uploads/worm"`; `async def put_evidence(kind: str, doc_id: str, payload: dict) -> str` — writes `EVIDENCE_ROOT/<kind>/<doc_id>/<utc-timestamp>.json` (create dirs; refuse to overwrite an existing file — raise `FileExistsError`); returns the path. `async def read_evidence(path: str, approval_id: str, accessor_id: str) -> dict` — requires a `worm_access_approvals/{approval_id}` doc with `status == "approved"` and two distinct approver ids (dual-control), else raise `PermissionError`; every read appends a `worm_access_log` doc `{path, approvalId, accessorId, at}`. Module constants `RETENTION_ACTIVE_YEARS = 3` and `RETENTION_ARCHIVE_YEARS = 5`. Wire `put_evidence` into the inspection handler (task 3.22 — store the inspection payload + photos) and the dispute path (order/inspection/dispute evidence per instructions.md §WS-03 step 3).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `worm.py` and the two call sites.
- [ ]

### Task 3.27 — Test WORM write and access logging
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: an inspection with photos writes a file under `.local_uploads/worm/inspection/...`; reading it without an approval → `PermissionError`; with a dual-approved `worm_access_approvals` doc → returns the payload and a `worm_access_log` entry exists; writing the same path twice raises `FileExistsError`.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k worm`
- EXPECT: exit 0.
- IF FAIL: fix `worm.py`; do not edit the test.
- [ ]

### Task 3.28 — Add multi-farmer cart checkout
- DO: Edit `backend/app/routers/emarket_customer.py` — add `POST /cart/checkout` (accepts `Idempotency-Key`): body `{lines: [{farmerId, lotId, qty, logisticsMode: "farmer_delivery" | "customer_pickup" | "platform_transport"}]}` (C6/F9). Validates each line's lot availability and the task-3.20 hoarding cap; creates one parent `customer_orders` doc (`isParent: true`, `orderValuePaisa` = sum of lines) plus one child `customer_orders` doc per distinct `farmerId` with `parentOrderId` set, its own `statusTimeline: [{status: "created", at}]`, its own escrow/deposit handling per task 3.14, and its `logisticsMode`. QR handover stays per child order via the existing `qr-handover` endpoint. Standard error envelope throughout.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handler.
- [ ]

### Task 3.29 — Test split shipments
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: cart with lines from 2 different farmers → exactly 2 child orders with the same `parentOrderId`, each carrying its own `statusTimeline` and `logisticsMode`; completing QR handover on one child leaves the other's status untouched; repeating checkout with the same `Idempotency-Key` creates no duplicates.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k cart`
- EXPECT: exit 0.
- IF FAIL: fix the checkout handler; do not edit the test.
- [ ]

### Task 3.30 — Add subscription/standing-demand endpoints
- DO: Edit `backend/app/routers/emarket_customer.py` — add `GET/POST/DELETE /subscriptions` over a new `customer_subscriptions` collection with doc shape `{id, customerId, farmerIds: list[str], crop, grade, qtyKg, targetPriceBandPaisa: {min, max}, deliveryWindow, frequency: "daily" | "weekly" | "seasonal", nextRunAt, status: "active", createdAt}` (C2 — the "weekly 5kg tomatoes from these 3 farmers" flow). POST computes `nextRunAt` from the frequency; DELETE marks `status: "cancelled"` (no hard delete). Writes accept `Idempotency-Key`; list paginates.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handlers.
- [ ]

### Task 3.31 — Add subscription planner job
- DO: Edit `backend/app/routers/jobs.py` (follow its existing job pattern): add `async def run_subscription_planner() -> dict` — for each `active` `customer_subscriptions` doc with `nextRunAt <= now`: create the recurring order through the SAME quote → escrow → inspection pipeline (create a quote per task 3.14's machinery targeted at the subscription's `farmerIds`, status `quote_pending`; never bypass escrow), then advance `nextRunAt` by the frequency. Register next to the file's other jobs. Return `{generated: <count>}`. Also honor the existing `GET /v1/customer/planner` cadence — read that handler first and reuse its scheduling logic if present.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the job.
- [ ]

### Task 3.32 — Test weekly subscription auto-order
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: subscription `weekly`, `qtyKg: 5`, `crop: "tomato"`, three `farmerIds`, `nextRunAt` in the past → run `run_subscription_planner()` → a quote/order exists referencing the subscription (`subscriptionId` on the generated doc) and `nextRunAt` advanced by 7 days; run the job again immediately → `generated: 0` (no duplicate).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k subscription`
- EXPECT: exit 0.
- IF FAIL: fix the job; do not edit the test.
- [ ]

### Task 3.33 — Add emarket seller commission to settlements
- DO: Edit `backend/app/services/settlements.py`: add `"emarketProducePct": 5` to `DEFAULT_CONFIG`; extend `run_settlements` with role `emarket_seller` keyed by that pct: query `customer_orders` with status `delivered` and `deliveredAt` in the period, exclude parent orders (`isParent`), group by `farmerId`, and write settlement docs with the existing shape (doc id `st_emarket_seller_{farmerId[:8]}_{period_start}`). Seller-side only — household consumers are never charged commission (instructions.md §WS-03 step 7). Integer math; `audit_logs` on every write.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k settlement`
- EXPECT: exit 0.
- IF FAIL: fix only `settlements.py`.
- [ ]

### Task 3.34 — Test 5% seller commission
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: a delivered child order worth 2,000,000 paisa for farmer F in the period → `run_settlements` writes a settlement doc with role `emarket_seller`, `entityId` = F, `commissionRupees` = exactly 5% of gross, `netRupees` = gross − commission.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k commission`
- EXPECT: exit 0.
- IF FAIL: fix `settlements.py`; do not edit the test.
- [ ]

### Task 3.35 — Add emarket_business plan and consolidated invoicing
- PRECONDITION: `test -f backend/app/services/billing.py && grep -q 'def require_entitlement' backend/app/services/billing.py` — else STOP (phase-00 gap).
- DO: Register plan `emarket_business` (bulk/institutional buyers) via the billing module's own mechanism (same discovery as task 2.20) with entitlements `{consolidated_gst_invoice: true, credit_terms: true}`. Edit `backend/app/routers/emarket_customer.py` — add `GET /invoices/consolidated?period=YYYY-MM` gated by entitlement `consolidated_gst_invoice`: builds ONE consolidated GST invoice doc over the caller's period orders (collection `customer_invoices`, fields `{id, customerId, period, lineItemCount, totalPaisa, gstPaisa, createdAt}` — integer paisa; GST computed with the repo's existing GST helper if one exists: `grep -rn 'gst' backend/app/services/ | head` — reuse it verbatim; if none exists, STOP and report the phase-00 gap). For `credit_terms`-entitled buyers, each new order also writes a `customer_credit_ledger` entry `{orderId, customerId, creditTermsDays, dueAt, amountPaisa, settledAt: null}` (C9; `creditTermsDays` from the plan/buyer config, default 30) settling through the same rails.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: align with the billing/GST helpers actually present; if absent, STOP (phase-00 gap).
- [ ]

### Task 3.36 — Test Business tier invoice and credit ledger
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: a buyer granted `emarket_business` with two delivered orders in one month → `GET /v1/customer/invoices/consolidated?period=...` returns one invoice with `lineItemCount: 2`; the orders produced `customer_credit_ledger` entries with `creditTermsDays` and null `settledAt`; a non-entitled buyer calling the same endpoint → 402/403 with the standard envelope.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k business`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint/ledger code; do not edit the test.
- [ ]

### Task 3.37 — Extend KYC matrix for business buyers
- PRECONDITION: `grep -rln 'kyc_cases' backend/app/` non-empty — else STOP (phase-00 gap).
- DO: Extend the phase-00 KYC document matrix (same file found in task 2.26) with persona `emarket_business`: required docs `gstin`, `pan`; conditional docs `udyam` (if applicable), `trade_licence` (Shop & Establishment), `apmc_mandi_licence` (mandi-linked categories), `fssai` (food processing/retail); constitution docs for partnership/LLP/company routed to `manual_review`; bank verified via penny-drop (phase-00 bank_verify marker — same field discovered in task 2.18). Create `backend/app/services/gstin.py` (new) with `GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")` and `async def verify_gstin(gstin: str) -> bool` — regex validation now, with the provider hook point documented in one comment (real API verification wiring follows the phase-00 provider-switch convention).
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: if no KYC matrix file exists, STOP (phase-00 gap); else fix the new entries.
- [ ]

### Task 3.38 — Gate quoting behind business KYC and attestations
- DO: Edit `backend/app/routers/emarket_customer.py` `create_quote` (`POST /quotes`): when the caller's user doc marks a business buyer (`accountType == "business"` — read the customer profile shape first: `grep -rn 'accountType\|business' backend/app/routers/emarket_customer.py backend/app/services/users.py | head`), require a `kyc_cases` doc with verified `gstin` AND `pan`, else 403 `KYC_REQUIRED` (quoting disabled until GST + PAN verified); household consumers (`accountType` absent/`household`) are exempt. First quote from a business buyer also requires body flags `antiHoardingAccepted: true` and `noOffPlatformAccepted: true` → else 422 `ATTESTATION_REQUIRED`; persist both flags with timestamps on the user doc.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the quote handler.
- [ ]

### Task 3.39 — Test unverified-GST quote rejection
- DO: Append to `backend/tests/test_saas_emarket_customer.py`: business buyer with no verified GSTIN/PAN → `POST /v1/customer/quotes` → 403 with `"KYC_REQUIRED"`; with verified GST+PAN but without attestations → 422 `"ATTESTATION_REQUIRED"`; with both → 201; household buyer without any KYC → 201.
- RUN: backend pytest `tests/test_saas_emarket_customer.py -q -k kyc`
- EXPECT: exit 0.
- IF FAIL: fix the gate; do not edit the test.
- [ ]

### Task 3.40 — Add customer dashboard summary items
- PRECONDITION: `grep -rq 'def emit_task' backend/app/ && test -f backend/app/routers/tasks.py` — else STOP (phase-01 gap).
- DO: In the phase-01 summary implementation (`backend/app/routers/tasks.py`), add customer-persona items: `openDemands` (count active `customer_demands`), `quotesAwaiting` (count quotes in a negotiable status), `ordersInTransit` (child `customer_orders` neither delivered nor cancelled), `inspectionsPending` (delivered orders with no inspection doc), `spendThisMonthPaisa` (sum of this month's order values, integer paisa), `favoriteFarmersNewLots` (available lots from `customer_favorite_suppliers` farmers created in the last 7 days). Emit `emit_task` items for actionable ones (quotes awaiting, inspections pending) with deepLinks to the new routes.
- RUN: backend pytest `-q -k "summary or customer"`
- EXPECT: exit 0.
- IF FAIL: align with the real summary code; if missing, STOP (phase-01 gap).
- [ ]

### Task 3.41 — HUMAN CHECK: FarmGate buying flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed (else start with `./run.sh --no-mobile`).
- DO: HUMAN CHECK: on the dev stack (1) post a demand as a household customer; (2) receive/create a binding quote → accept → fund the deposit (escrow status visible on the order); (3) run a 2-farmer cart checkout → two child orders tracked independently through split delivery; (4) submit a photo inspection → accept → escrow release reflected; (5) create a weekly subscription from 3 favorite farmers and confirm its next run date; (6) repeat in Hindi confirming no English-only strings.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step.
- IF FAIL: record the broken step, fix the responsible file, re-run its task check, repeat once.
- [ ]

### Task 3.42 — WS-03 checkpoint
- DO: Run the full WS-03 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-04 WS-03: e-market customer FarmGate"`
- EXPECT: pytest green; tsc+build clean; commit succeeds (identity issues: note and continue).
- IF FAIL: fix the failure at its source task; do not commit red.
- [ ]

## WS-04 — Gyan Hub  (see instructions.md §WS-04)

### Task 4.1 — Add workshop enroll/verify endpoint
- DO: Edit `backend/app/routers/gyan.py` — add `POST /workshops/{workshop_id}/enroll/verify` mirroring `courses.py::verify_purchase` (read it, ~line 465): body `{razorpayOrderId, razorpayPaymentId, razorpaySignature}`; look up the caller's enrollment doc `users/{uid}/workshop_enrollments/{workshop_id}` by `razorpayOrderId`; 404 `ENROLLMENT_NOT_FOUND` when absent; if already `status == "enrolled"` return `{"enrolled": True}` unchanged (idempotent — duplicate verify is a no-op, no double `enrolledCount`); verify via `verify_razorpay_signature(...)` → failure 400 `PAYMENT_VERIFICATION_FAILED`; on success flip status to `enrolled`, stamp `razorpayPaymentId` + `enrolledAt`, increment the workshop's `enrolledCount`, and return `{"enrolled": True}`. Accept `Idempotency-Key`; standard error envelope throughout.
- RUN: backend pytest `tests/test_gyan.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the new handler.
- [ ]

### Task 4.2 — Create test_gyan_payments.py: enroll → verify
- DO: Create `backend/tests/test_gyan_payments.py` (new), following `backend/tests/test_gyan.py` fixtures: paid workshop enroll → response carries `paymentOrderId` and enrollment stays `awaiting_payment`; `POST /v1/workshops/{wid}/enroll/verify` with the suite's Razorpay stub path → `enrolled` and `enrolledCount` incremented by 1; a second identical verify → still `enrolled`, `enrolledCount` unchanged (no stranded `awaiting_payment`, no double count); a bad signature → 400 with `"PAYMENT_VERIFICATION_FAILED"`.
- RUN: backend pytest `tests/test_gyan_payments.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint; do not edit the test.
- [ ]

### Task 4.3 — Apply 50%-of-order coin cap to workshop enroll
- DO: Edit `backend/app/routers/gyan.py` `enroll_workshop` (~line 51): inside the `body.useCoins` branch, read `cfg = await get_doc("platform_config", "gamification") or {}` and `pct = int(cfg.get("redemptionMaxPctOfOrder", 50))`; extend the rejection condition to also reject `coins > int(workshop["feeRupees"]) * pct // 100` with the same 422 `INVALID_COIN_AMOUNT` envelope (X11 — WS-01 step 6 applied to gyan, per instructions.md §WS-04 step 1).
- RUN: backend pytest `tests/test_gyan.py -q`
- EXPECT: exit 0.
- IF FAIL: adjust any stale test coin amounts to respect the cap; keep the cap.
- [ ]

### Task 4.4 — Test workshop coin cap and expert-talk award cap
- PRECONDITION: `grep -q 'dailyEarnCap' backend/app/services/coins.py` — WS-01 task 1.20 must be done; if this fails, complete task 1.20 first (do not proceed).
- DO: Append to `backend/tests/test_gyan_payments.py`: (a) workshop `feeRupees` 1000, `coinsDiscountAllowed` 800 → `coinsToRedeem: 600` rejected 422 `"INVALID_COIN_AMOUNT"`, `coinsToRedeem: 500` accepted; (b) expert-talk register awards exactly 25 coins (`agriCoinsEarned: 25` in the response and a +25 ledger entry); (c) after the user has already earned 190 coins today, registering yields only 10 additional coins (200/day cap respected — the award flows through `award_coins`).
- RUN: backend pytest `tests/test_gyan_payments.py -q`
- EXPECT: exit 0.
- IF FAIL: fix `gyan.py` (never special-case the expert-talk award around `award_coins`).
- [ ]

### Task 4.5 — Create gyan locale pair and register it
- DO: Create `website/src/lib/i18n/locales/en.gyan.ts` and `website/src/lib/i18n/locales/hi.gyan.ts` (both new, `en.trade.ts` pattern). Seed: `gyanHubTitle` ('Gyan Hub' / 'ज्ञान हब'), `gyanWorkshops` ('Workshops' / 'कार्यशालाएँ'), `gyanExpertTalks` ('Expert Talks' / 'विशेषज्ञ वार्ता'), `gyanVideos` ('Video Library' / 'वीडियो लाइब्रेरी'), `gyanBlogs` ('Blogs' / 'ब्लॉग'), `gyanCoinsEarned` ('+25 AgriCoins earned' / '+25 एग्रीकॉइन मिले'). Add both imports to `website/src/main.tsx` after the emarket imports.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the new files/imports only.
- [ ]

### Task 4.6 — Create gyan.ts API wrapper
- DO: Create `website/src/lib/api/gyan.ts` (new) following `instructorAcademy.ts` conventions, covering every gyan endpoint: `listWorkshops()` → `GET /v1/workshops`; `enrollWorkshop(workshopId, {useCoins, coinsToRedeem})` → `POST /v1/workshops/{wid}/enroll`; `verifyWorkshopEnroll(workshopId, {razorpayOrderId, razorpayPaymentId, razorpaySignature})` → `POST /v1/workshops/{wid}/enroll/verify` (task 4.1); `listExpertTalks()` / `registerExpertTalk(talkId)` (response has `agriCoinsEarned`) / `postTalkQuestion(talkId, question)`; `listVideos()`; `listBlogs()` / `bookmarkBlog(blogId)` / `likeBlog(blogId)`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new wrapper.
- [ ]

### Task 4.7 — Create GyanHubHome
- DO: Create `website/src/views/gyan/GyanHubHome.tsx` (new): the 4-section knowledge home (Workshops / Expert Talks / Video Library / Blogs) with a section card each deep-linking to its page. All strings `t()` en+hi (gyan pair).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new file and locale files.
- [ ]

### Task 4.8 — Create WorkshopsPage with purchase flow
- DO: Create `website/src/views/gyan/WorkshopsPage.tsx` (new): workshop list with seat availability (`enrolledCount`/`totalSeats`); detail view with a coins slider capped at exactly `Math.min(workshop.coinsDiscountAllowed, Math.floor(workshop.feeRupees), Math.floor(workshop.feeRupees * 0.5), coinBalance)` (same X11 math as WS-01 task 1.12 — reuse `getCoinBalance` from `courses.ts`); Razorpay checkout via `openRazorpayCheckout` for the remainder, then `verifyWorkshopEnroll`, then enrolled state. Errors via toast/modal, never `alert()`. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and locale files.
- [ ]

### Task 4.9 — Create ExpertTalksPage
- DO: Create `website/src/views/gyan/ExpertTalksPage.tsx` (new): expert-talk list; register button calling `registerExpertTalk` and showing the `t('gyanCoinsEarned')` toast on success; pre-talk question submission form (`postTalkQuestion`). All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page.
- [ ]

### Task 4.10 — Create VideoLibraryPage and BlogsPage
- DO: Create `website/src/views/gyan/VideoLibraryPage.tsx` (new — grid from `listVideos()` with an embedded player per item) and `website/src/views/gyan/BlogsPage.tsx` (new — list from `listBlogs()` with bookmark and like actions per item). All strings `t()` en+hi; no hardcoded strings.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the two new pages.
- [ ]

### Task 4.11 — Wire cross-links between gyan and courses
- DO: One CMS, two storefronts (instructions.md §WS-04 step 5) — reference by id, no duplicated content model. Edit `website/src/views/gyan/WorkshopsPage.tsx`, `ExpertTalksPage.tsx`, and `BlogsPage.tsx`: on each detail view, render a "Related courses" block listing courses from `listCourses({search: <item topic tag or category>})` filtered client-side to the same instructor when the item carries an `instructorId`, each card deep-linking to `/dashboard/p/courses/{courseId}` (WS-01 CourseDetailPage). Edit `website/src/views/academy/CourseDetailPage.tsx`: render a "Related workshops & talks" block (same instructor/topic, from `listWorkshops()`/`listExpertTalks()`) deep-linking to the gyan pages. Render the blocks only when matches exist (no empty placeholders). All strings en+hi in both locale pairs.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the four pages and locale files.
- [ ]

### Task 4.12 — Register gyanHub tile and routes
- DO: Create `website/src/views/gyan/index.tsx` (new) exporting `GYAN_PAGES` mapping `gyanHub` → `GyanHubHome`, `gyanWorkshops` → `WorkshopsPage`, `gyanTalks` → `ExpertTalksPage`, `gyanVideos` → `VideoLibraryPage`, `gyanBlogs` → `BlogsPage`; merge into `ToolPage.tsx` following the ACADEMY_PAGES merge pattern (task 1.17). Add deep routes in `website/src/App.tsx`. Verify the existing `gyanHub` module id in `website/src/lib/dashboard.ts` now resolves to a real page (do not duplicate the toolId).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix registry/route wiring only.
- [ ]

### Task 4.13 — Emit gyan dashboard tasks
- PRECONDITION: `grep -rq 'def emit_task' backend/app/` — else STOP (phase-01 gap).
- DO: Edit `backend/app/routers/gyan.py`: in `enroll_workshop`'s free-enrollment branch and in the task-4.1 verify handler (after flipping to `enrolled`), emit task kind `workshop_starting` ("workshop you booked starts at …") with the workshop's schedule and `deepLink` `/dashboard/p/gyanHub`; in `register_expert_talk` after the coin award, emit kind `coins_earned` ("+25 coins from expert talk") with `deepLink` `/dashboard/p/gyanHub`; in the videos listing handler, when a video in the caller's crop category was created in the last 7 days, emit kind `new_video` ("new video in your crop category") — dedupe-safe via `sourceId` = video id. Bilingual `title_en`/`title_hi` per the phase-01 `emit_task` signature.
- RUN: backend pytest `tests/test_gyan_payments.py tests/test_gyan.py -q`
- EXPECT: exit 0.
- IF FAIL: align kwargs with the real `emit_task` signature.
- [ ]

### Task 4.14 — HUMAN CHECK: gyan flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed (else `./run.sh --no-mobile`).
- DO: HUMAN CHECK: (1) dashboard `gyanHub` tile → Gyan Hub home renders 4 sections; (2) open a paid workshop → pay with coins + Razorpay test mode → enrolled state shows (no stranded awaiting-payment); (3) register for an expert talk → +25 coins toast appears; (4) a workshop detail shows related courses and a course detail shows related workshops; (5) repeat in Hindi.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step.
- IF FAIL: record the broken step, fix, re-run the implicated task check, repeat once.
- [ ]

### Task 4.15 — WS-04 checkpoint
- DO: Run the full WS-04 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-04 WS-04: Gyan Hub"`
- EXPECT: pytest green; tsc+build clean; commit succeeds.
- IF FAIL: fix at the source task; do not commit red.
- [ ]

## WS-05 — Agri News + Live Channels  (see instructions.md §WS-05)

### Task 5.1 — Create content.ts API wrapper
- DO: Create `website/src/lib/api/content.ts` (new) following `instructorAcademy.ts` conventions, covering: `listNews(category?)` → `GET /v1/news`; `listChannels()` → `GET /v1/channels` (items carry live viewer counts); `getChannelSchedule()` → `GET /v1/channels/schedule` (items carry `hasReminder`); `toggleScheduleReminder(bcastId)` → `POST /v1/channels/schedule/{bcast_id}/remind`; `getChannelChat(channelId)` / `postChannelChat(channelId, text)`; `pinChannelMessage(channelId, messageId)` → `PUT /v1/channels/{cid}/pin`; `getPolls`/`createPoll`/`votePoll(channelId, pollId, optionId)`; `getQuestions`/`postQuestion`/`upvoteQuestion(channelId, qId)`. Comment that `POST /v1/channels` (create) is admin-only after task 5.7.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new wrapper.
- [ ]

### Task 5.2 — Create news + channels locale pairs
- DO: Create four files following the `en.trade.ts` pattern: `website/src/lib/i18n/locales/en.news.ts`, `hi.news.ts`, `en.channels.ts`, `hi.channels.ts`. Seed news pair: `newsTitle` ('Agri News' / 'कृषि समाचार'), `newsListen` ('Listen' / 'सुनें'), `newsShareWhatsApp` ('Share on WhatsApp' / 'व्हाट्सऐप पर साझा करें'), `newsBreaking` ('Breaking' / 'ब्रेकिंग'), `newsImpact` ('Impact' / 'प्रभाव'). Seed channels pair: `channelsTitle` ('Live Channels' / 'लाइव चैनल'), `channelsLive` ('LIVE' / 'लाइव'), `channelsRemindMe` ('Remind me' / 'मुझे याद दिलाएँ'), `channelsSchedule` ('Schedule' / 'कार्यक्रम'), `channelsChatPlaceholder` ('Type a message…' / 'संदेश लिखें…'). Add all four imports to `website/src/main.tsx` after the gyan imports.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix the new files/imports only.
- [ ]

### Task 5.3 — Create NewsFeedPage
- DO: Create `website/src/views/news/NewsFeedPage.tsx` (new): category filter chips built from the categories observed in the `listNews()` response (no hardcoded category list); each item shows title, category, timestamp, and an impact-rating badge from `impactRating`; per-item **Listen** button playing the item's `audioText` via the browser `speechSynthesis` API in the user's current locale (`speechSynthesis.speak(new SpeechSynthesisUtterance(audioText))` with `utterance.lang` set from the i18n language — client-side readout only, not the retired voice-AI program); per-item WhatsApp share button opening `https://wa.me/?text=<encodeURIComponent(title + ' ' + shareUrl)>` with the item's deep link. All strings en+hi (news pair).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and locale files.
- [ ]

### Task 5.4 — Create NewsDetailPage
- DO: Create `website/src/views/news/NewsDetailPage.tsx` (new): full article view for a selected news item (title, body, category, impact badge, timestamp) with the same Listen and WhatsApp-share actions as the feed. All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page.
- [ ]

### Task 5.5 — Create BreakingBanner on the dashboard
- DO: Create `website/src/components/news/BreakingBanner.tsx` (new): calls `listNews()`; when any item has `isBreaking == true` and a `timestamp` within the last 24h, renders a banner (most recent breaking item) linking to the news feed; renders nothing otherwise. Mount it in the farmer dashboard home view (find it via `grep -rln 'dashboard' website/src/views/dashboard/ | head` and read the home component first; mount near the top). All strings en+hi.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the component and the mount point.
- [ ]

### Task 5.6 — Add hls.js dependency
- DO: From cwd `website/`, run `pnpm add hls.js`.
- RUN: `grep -c '"hls.js"' website/package.json`
- EXPECT: prints `1`; exit 0.
- IF FAIL: retry once; if the registry is unreachable, STOP and report.
- [ ]

### Task 5.7 — Gate channel creation behind admin
- DO: Edit `backend/app/routers/content.py` `create_channel` (`POST /channels`, ~line 74): before creating, require admin — same predicate as `backend/app/routers/admin.py::_require_admin` (read it: user `isAdmin` true or `activeProfile == "admin"`; replicate that check inline, do not import the private function); non-admin → 403 with envelope code `FORBIDDEN_ADMIN`. X16 v1 = embedded licensed streams only; no user-originated streams (instructions.md §WS-05 step 4).
- RUN: backend pytest `tests/test_content.py -q`
- EXPECT: exit 0.
- IF FAIL: an existing test creates channels as a regular user — update its fixture to use an admin user; keep the gate.
- [ ]

### Task 5.8 — Test non-admin channel creation rejected
- DO: Append to `backend/tests/test_content.py`: `POST /v1/channels` as a normal user → 403 with `"FORBIDDEN_ADMIN"`; same call as an admin-fixture user → 201.
- RUN: backend pytest `tests/test_content.py -q -k admin`
- EXPECT: exit 0.
- IF FAIL: fix the gate; do not edit the test.
- [ ]

### Task 5.9 — Seed licensed channel streams
- DO: Edit `backend/app/data/content_seed.py` (read it first, follow its existing seed-doc shape for `channels`): add seed channel docs for licensed embedded streams — DD Kisan (HLS `streamUrl` `https://ddkisan.akamaized.net/hls/live/2007789/ddkisan/master.m3u8`) and one placeholder-free second licensed agri channel only if its licensed HLS URL is already referenced somewhere in the repo/docs (`grep -rn 'm3u8' backend/ docs/ | head`); fields matching the existing channel doc shape (`channelName`, `broadcaster`, `programTitle`, `category`, `streamUrl`, `isLiveNow`, `scheduleTime`). No invented stream URLs.
- RUN: backend pytest `tests/test_content.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the seed docs to match the existing shape.
- [ ]

### Task 5.10 — Write dated deferral note: platform-originated streaming
- DO: Append to `missing-features/robust.md` under the §7.19 (Live Channels) entry a dated deferral note (rule 10, dated today): platform-originated live streaming infrastructure (X16) is deferred; v1 ships embedded licensed streams only, and `POST /v1/channels` is admin-gated.
- RUN: `grep -n 'X16' missing-features/robust.md | head -3`
- EXPECT: at least one match printed.
- IF FAIL: re-open the file and place the note under the correct §7.19 heading.
- [ ]

### Task 5.11 — Write dated deferral note: news CMS
- DO: Append to `missing-features/robust.md` under the §7.18 (Agri News) entry a dated deferral note: the admin news CMS is deferred to phase-07 module 20; this phase ships the read-only consumer feed only.
- RUN: `grep -n 'module 20' missing-features/robust.md | head -2`
- EXPECT: at least one match printed.
- IF FAIL: place the note under the correct §7.18 heading.
- [ ]

### Task 5.12 — Add server-side chat moderation to channel chat
- PRECONDITION: `grep -q 'contains_banned_content' backend/app/services/chat.py` — WS-02 task 2.34 must be done; if not, complete task 2.34 first.
- DO: Edit `backend/app/routers/content.py` `post_chat` (~line 147): after the empty-text check and before rate limiting, run `contains_banned_content(text)` (import from `app.services.chat`); on a match call `record_strike(user["id"], "channel_chat", <category>)` and reject 422 with envelope code `MODERATION_BLOCKED` (global rule 4 — no phone numbers, UPI IDs, or external links). Keep the existing Redis 2-second per-user rate limit; if the user doc's `chatMutedUntil` is in the future, reject 429 `CHAT_MUTED` (strike ladder reuse from WS-02). AI moderation `content.moderation.v1` is phase-06 — baseline regex only here.
- RUN: backend pytest `tests/test_content.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only the chat handler.
- [ ]

### Task 5.13 — Test channel chat moderation
- DO: Append to `backend/tests/test_content.py`: posting `call me 9876543210` to a channel chat → 422 with `"MODERATION_BLOCKED"` and a strike doc under the user's `strikes`; posting `send to ram@upi` → 422; posting a normal message → 201.
- RUN: backend pytest `tests/test_content.py -q -k moderation`
- EXPECT: exit 0.
- IF FAIL: fix the handler; do not edit the test.
- [ ]

### Task 5.14 — Create ChannelGridPage
- DO: Create `website/src/views/channels/ChannelGridPage.tsx` (new): grid from `listChannels()`; live badge (`channelsLive`) when `isLiveNow`, live viewer count per channel, category label; each card navigates to the player. All strings en+hi (channels pair).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page.
- [ ]

### Task 5.15 — Create ChannelPlayerPage
- DO: Create `website/src/views/channels/ChannelPlayerPage.tsx` (new). Reads `:channelId`. HLS playback: if `Hls.isSupported()` (import from `hls.js`, task 5.6) attach `new Hls()` to a `<video>` and `loadSource(channel.streamUrl)`; else if the video element `canPlayType('application/vnd.apple.mpegurl')` set `src` directly (native HLS fallback). Render: `pinnedAnnouncement` when non-empty; schedule list from `getChannelSchedule()` with a **remind me** toggle calling `toggleScheduleReminder` (reflect `hasReminder`); live chat panel (`getChannelChat` poll + `postChannelChat`, surfacing the `MODERATION_BLOCKED` error via toast); polls (`getPolls`/`votePoll`) and viewer Q&A (`getQuestions`/`postQuestion`/`upvoteQuestion`). All strings en+hi; no `alert()`.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the new page and locale files.
- [ ]

### Task 5.16 — Register agriNews + liveChannels tiles and tasks
- DO: Create `website/src/views/news/index.tsx` (new, `NEWS_PAGES`: `agriNews` → `NewsFeedPage`, `newsDetail` → `NewsDetailPage`) and `website/src/views/channels/index.tsx` (new, `CHANNEL_PAGES`: `liveChannels` → `ChannelGridPage`, `channelPlayer` → `ChannelPlayerPage`); merge both into `ToolPage.tsx` following the existing merge pattern. Add deep routes in `website/src/App.tsx` (`/dashboard/p/agriNews/:newsId`, `/dashboard/p/liveChannels/:channelId`). Verify the existing `agriNews` and `liveChannels` module ids in `website/src/lib/dashboard.ts` resolve (do not duplicate). PRECONDITION for the task-emission half: `grep -rq 'def emit_task' backend/app/` — if it fails, do the frontend half and STOP the phase afterwards (phase-01 gap). Edit `backend/app/routers/content.py`: emit task kind `breaking_news` (when a fresh `isBreaking` item exists, deepLink `/dashboard/p/agriNews`) and kind `live_now` ("live now: <program>" when a channel has `isLiveNow`, deepLink `/dashboard/p/liveChannels`) from the respective list handlers, dedupe-safe via `sourceId`.
- RUN: website tsc && backend pytest `tests/test_content.py -q`
- EXPECT: both exit 0.
- IF FAIL: fix the failing side only.
- [ ]

### Task 5.17 — HUMAN CHECK: news + channels flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed (else `./run.sh --no-mobile`).
- DO: HUMAN CHECK: (1) with a breaking seed item present, the dashboard shows the breaking banner → click → news detail; (2) play the audio readout on a news item; (3) share an item to WhatsApp (share sheet/URL opens); (4) `liveChannels` tile → channel grid → player plays the embedded licensed HLS stream (DD Kisan seed); (5) set a schedule reminder → reload → reminder persisted; (6) post a chat message containing a phone number → rejected with a toast; (7) repeat in Hindi.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step.
- IF FAIL: record the broken step, fix, re-run the implicated task check, repeat once.
- [ ]

### Task 5.18 — WS-05 checkpoint
- DO: Run the full WS-05 Verification block, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-04 WS-05: agri news and live channels"`
- EXPECT: pytest green; tsc+build clean; commit succeeds.
- IF FAIL: fix at the source task; do not commit red.
- [ ]

## WS-06 — AI courses intelligence (brief M20)  (see instructions.md §WS-06)

### Task 6.1 — Register courses.recommend.v1 question set
- PRECONDITION: `test -d backend/app/services/ai && test -f backend/app/services/ai/gateway.py && test -f backend/app/services/ai/question_sets.py` — phase-00 WS-07 AI gateway must exist; if this fails, STOP the phase (playbook §5).
- DO: Read `backend/app/services/ai/question_sets.py` and follow its registration shape exactly. Register `courses.recommend.v1`: batch type, per-course `relevance` score output, a `confidence_threshold`, automation level **`suggest`** (global rule 12 — new AI features launch at suggest), and `fallback_fn` = deterministic ordering (newest published course in the farmer's crop categories, then popularity by `salesCount`). Edit the AI module-flag config (follow the phase-00 convention — `platform_config/ai` doc): add `modules.courses_recommend: true`.
- RUN: backend pytest `-q -k "ai or question_set"`
- EXPECT: exit 0.
- IF FAIL: align with the real registration API; if `question_sets.py` doesn't exist, STOP (phase-00 gap).
- [ ]

### Task 6.2 — Add golden fixture for courses.recommend.v1
- DO: Create `backend/tests/fixtures/ai/golden/courses.recommend.v1.jsonl` (new — create parent dirs) following the exact format of the existing golden fixtures in `backend/tests/fixtures/ai/golden/` (read one first): at least 3 records covering (a) a farmer whose crops match a published course (high relevance), (b) a farmer with no matching crops (low relevance), (c) a batch of several courses ranked by relevance. Use only pseudonymized fields — no phone/email/Aadhaar anywhere in the fixture (global rule 11).
- RUN: `wc -l backend/tests/fixtures/ai/golden/courses.recommend.v1.jsonl`
- EXPECT: prints `3 backend/tests/fixtures/ai/golden/courses.recommend.v1.jsonl` (or more lines).
- IF FAIL: fix the fixture format to match the sibling fixtures.
- [ ]

### Task 6.3 — Build pseudonymized farmer course state
- PRECONDITION: `test -f backend/app/services/ai/privacy.py` — else STOP (phase-00 gap).
- DO: Create `backend/app/services/academy_ai.py` (new) with `async def build_farmer_course_state(uid: str) -> dict`: using `services/ai/privacy.py`'s pseudonymization helper (read it, use it verbatim), assemble `{crops, district, currentSeason, completedCourseIds, inProgressCourseIds}` from the user doc and `course_purchases`; the payload must stay ≤1,500 tokens and contain no phone/email/Aadhaar (assert the privacy helper's redaction is applied — global rule 11).
- RUN: backend pytest `-q -k academy_ai`
- EXPECT: exit 0 (no tests yet is fine — import smoke: the module imports cleanly; add the run as `.venv/bin/python -c "import app.services.academy_ai"` from `backend/` if no test matches).
- IF FAIL: fix only the new module.
- [ ]

### Task 6.4 — Add recommendations endpoint with 24h cache
- DO: Edit `backend/app/routers/courses.py` — add `GET /courses/recommendations` (mounted BEFORE the `/courses/{course_id}` route so it isn't captured by the path param): build state via task 6.3, call `await gateway.decide(state, "courses.recommend.v1", ctx)` (read `services/ai/gateway.py` for the real `decide` signature and ctx shape), and Redis-cache the ranked result per farmer for 24h (key `ai:courses_recommend:{uid}`, `ex=86400` — follow the repo's Redis usage pattern in `content.py`; never cache per page-view). When the module flag `modules.courses_recommend` is off, the gateway raises, or `AI_PROVIDER=shim` returns no ranking, return the question set's `fallback_fn` ordering in the SAME response shape (`{data: [{courseId, relevance, badges: [...]}], source: "ai" | "fallback"}`).
- RUN: backend pytest `tests/test_courses.py -q`
- EXPECT: exit 0.
- IF FAIL: match the real gateway signature; never call OpenRouter/Gemini from the router (global rule 10).
- [ ]

### Task 6.5 — Test recommendation shim, fallback, and flag-off
- DO: Create `backend/tests/test_academy_ai.py` (new): (a) shim round-trip — with `AI_PROVIDER=shim` and the flag on, `GET /v1/courses/recommendations` returns the same shape as the fallback path and a 24h cache hit on the second call (second call does not re-invoke the gateway — assert via the shim/gateway call counter the phase-00 test utilities expose, or by monkeypatching `gateway.decide` and counting); (b) gateway raising → response uses `fallback_fn` ordering with `source: "fallback"`; (c) module flag off → identical response shape with `source: "fallback"`; (d) golden fixture replay per the phase-00 golden-test convention (read an existing AI test for the pattern — `grep -rln 'golden' backend/tests/ | head`).
- RUN: backend pytest `tests/test_academy_ai.py -q`
- EXPECT: exit 0.
- IF FAIL: fix the endpoint/state builder; do not edit the test.
- [ ]

### Task 6.6 — Annotate catalog with relevance badges
- DO: Edit `website/src/views/academy/CourseCatalogPage.tsx`: on load, also fetch `GET /v1/courses/recommendations` (add `getCourseRecommendations()` to `website/src/lib/api/courses.ts`); sort/annotate matching course cards with a suggest-level badge `t('academyMatchesYourCrops')` ('Matches your crops' / 'आपकी फसलों से मेल खाता है' — add to both locale files). On error/empty/`source: "fallback"` render the identical card layout with no badge row collapsing (same UX shape — instructions.md §WS-06 step 3).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the page, wrapper, and locale files.
- [ ]

### Task 6.7 — Add objective auto-grading with strict rubric
- DO: Edit `backend/app/services/academy_ai.py` — append a strict Pydantic rubric model `RubricGradeItem {questionId: str, score: int, maxScore: int, feedbackKey: str}` and `RubricGrade {items: list[RubricGradeItem], overallFeedbackKey: str}`; append `async def suggest_assignment_grade(submission: dict, *, user_lang: str) -> dict | None` (SGR recipe): call `gateway.generate(prompt, model="lite", json_schema=RubricGrade.model_json_schema(), lang=user_lang)` (read `services/ai/gateway.py` for the real generate signature); validate the output against `RubricGrade`; on validation failure retry ONCE with a repair prompt; on second failure return `None` (fallback = no suggestion — instructor grades manually). Wire the call: when an assignment submission doc is created/graded-viewed, store the suggestion on the submission doc as `aiSuggestion: {rubric: <validated>, decision_id: <gateway decision id>}` — prefill only, `require_confirm` level; NEVER auto-publish (global rule 12). The actual grade write still goes through the existing `POST /v1/teachers/assignments/{aid}/grade` handler — do not change its confirmation semantics.
- RUN: backend pytest `tests/test_academy_ai.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `academy_ai.py` and its call site.
- [ ]

### Task 6.8 — Test rubric validation and repair fallback
- DO: Append to `backend/tests/test_academy_ai.py`: (a) well-formed shim output → suggestion stored on the submission doc with a `decision_id`; (b) malformed Gemini output (missing `maxScore`) → one repair retry happens (assert call count 2) and if still malformed → no `aiSuggestion` stored (fallback = manual grading); (c) module flag off → no gateway call, no suggestion, the existing grade endpoint still works.
- RUN: backend pytest `tests/test_academy_ai.py -q -k rubric`
- EXPECT: exit 0.
- IF FAIL: fix `academy_ai.py`; do not edit the test.
- [ ]

### Task 6.9 — Surface AI prefill in AssignmentsPage
- DO: Edit `website/src/views/instructor/AssignmentsPage.tsx` (the container from task 2.6): when an assignment doc carries `aiSuggestion`, prefill the grade form fields from `aiSuggestion.rubric` and show a `t()` notice `instructorAiPrefillNotice` ('AI suggestion — review before publishing' / 'AI सुझाव — प्रकाशित करने से पहले समीक्षा करें' — add to both instructor locale files). Publishing still requires the instructor to submit the grade form explicitly (require_confirm — the prefill must never auto-submit).
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the page and locale files.
- [ ]

### Task 6.10 — Add learning-path suggestion on certificate
- DO: Edit `backend/app/services/academy_ai.py` — append `async def suggest_learning_path(uid: str, certificate_id: str) -> dict` (C20): cache per (farmer, certificate) (Redis key `ai:learning_path:{uid}:{certificate_id}`, `ex=86400`); build the next-course sequence from the farmer's crops/season/skill gaps (completed courses) via `gateway.decide` with the `courses.recommend.v1` machinery where applicable; fallback = the most popular published course in the certificate's category (`salesCount` desc). Emit a phase-01 task kind `next_course_for_you` deep-linking to `/dashboard/p/courses` (PRECONDITION for this call: `grep -rq 'def emit_task' backend/app/` — if it fails, store the suggestion without the task emission and STOP the phase afterwards, phase-01 gap). Hook it: call from the certificate issuance paths — `courses.py` certificate handler (~line 600) and `teachers.py` `POST /courses/{cid}/students/{sid}/certificate` (~line 155) — storing the result on the purchase doc as `learningPath: {courseIds: [...], source: "ai" | "fallback"}`.
- RUN: backend pytest `tests/test_academy_ai.py -q`
- EXPECT: exit 0.
- IF FAIL: fix only `academy_ai.py` and the two call sites.
- [ ]

### Task 6.11 — Test learning-path after certificate
- DO: Append to `backend/tests/test_academy_ai.py`: issue a certificate via the teachers endpoint → the purchase doc gains `learningPath.courseIds` and an `ai_decisions` doc exists for the call; with the gateway patched to raise → `learningPath.source == "fallback"` and the course id equals the category's most-sold course; second call → cached (no new `ai_decisions` doc).
- RUN: backend pytest `tests/test_academy_ai.py -q -k learning`
- EXPECT: exit 0.
- IF FAIL: fix the hook; do not edit the test.
- [ ]

### Task 6.12 — Show learning-path card on CertificatePage
- DO: Edit `website/src/views/academy/CertificatePage.tsx`: when the certificate/purchase payload carries `learningPath.courseIds`, render a "next course for you" suggestion card per course id (title via `getCourse`) deep-linking to `/dashboard/p/courses/{id}`; strings `academyNextCourseTitle` ('Next course for you' / 'आपके लिए अगला पाठ्यक्रम') in both academy locale files. Render nothing when absent.
- RUN: website tsc
- EXPECT: exit 0.
- IF FAIL: fix only the page and locale files.
- [ ]

### Task 6.13 — Verify ai_decisions logging and outcome hooks
- PRECONDITION: `test -f backend/app/services/ai/decision_log.py` — else STOP (phase-00 gap).
- DO: Append to `backend/tests/test_academy_ai.py`: after exercising the recommendation, grading-suggestion, and learning-path paths, assert each wrote an `ai_decisions` doc containing `cost` and `confidence` fields (global rule 11). Register outcome hooks following the phase-00 convention (read `decision_log.py`): `purchase_after_recommendation` (a purchase of a recommended course within 7 days) and `grade_delta_vs_suggestion` (published grade vs AI suggestion delta) — hook them into the purchase-verify handler and the assignment-grade handler respectively, using the decision ids stored on the docs.
- RUN: backend pytest `tests/test_academy_ai.py -q -k decisions`
- EXPECT: exit 0.
- IF FAIL: align with the real `decision_log.py` API; if it lacks outcome-hook support, STOP (phase-00 gap).
- [ ]

### Task 6.14 — HUMAN CHECK: AI surfaces with shim
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed (stack started with `AI_PROVIDER=shim` — the dev default; else restart via `./run.sh --no-mobile`).
- DO: HUMAN CHECK: (1) learner catalog shows "Matches your crops" badges on relevant courses; (2) reload the catalog — badges render instantly (24h cache hit); (3) instructor opens a submitted assignment → AI prefill appears with the review notice → confirm publishes the grade; (4) complete a course → certificate page shows the learning-path card; (5) repeat the catalog step with the module flag off (human operator flips `modules.courses_recommend` in `platform_config/ai`) → same layout, no badges, no errors.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms every step works on `AI_PROVIDER=shim`.
- IF FAIL: record the broken step, fix, re-run the implicated task check, repeat once.
- [ ]

### Task 6.15 — WS-06 checkpoint
- DO: Run the WS-06 Verification block (full suite + shim), then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `git add -A && git commit -m "phase-04 WS-06: AI courses intelligence M20"`
- EXPECT: pytest green under shim; tsc+build clean; commit succeeds.
- IF FAIL: fix at the source task; do not commit red.
- [ ]

## Phase-final gate  (see readme.md §Exit gate + execution-plan/README.md §4)

### Task F.1 — Full backend suite green
- DO: Run the complete backend test suite from a clean state.
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: exit 0, zero failures.
- IF FAIL: fix the failing test at its source workstream task; never delete a test (playbook §3 rule 2).
- [ ]

### Task F.2 — Full suite green with AI_PROVIDER=shim
- DO: Re-run the complete suite explicitly under the shim provider.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: exit 0, zero failures.
- IF FAIL: a feature called a paid API or bypassed the gateway — route it through `backend/app/services/ai/gateway.py` (global rule 10) and re-run.
- [ ]

### Task F.3 — Website typecheck and build clean
- DO: Run the global website gate.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both; build completes.
- IF FAIL: fix the reported error at its source file.
- [ ]

### Task F.4 — Locale parity for all new domains
- DO: Verify en/hi key parity for every locale domain added by this phase.
- RUN: `cd website && for d in academy instructor emarket gyan news channels; do diff <(grep -oE '^  [a-zA-Z0-9]+:' src/lib/i18n/locales/en.$d.ts | sort -u) <(grep -oE '^  [a-zA-Z0-9]+:' src/lib/i18n/locales/hi.$d.ts | sort -u) > /dev/null && echo "$d OK" || echo "$d MISMATCH"; done`
- EXPECT: six lines, each ending `OK`.
- IF FAIL: for each MISMATCH, run the same diff without `> /dev/null`, add the missing keys to the lagging file, and re-run.
- [ ]

### Task F.5 — No hardcoded strings or dialogs in new views
- DO: Verify playbook §3 rule 3/6 across every view directory this phase created or rewrote.
- RUN: `grep -rnE 'alert\(|confirm\(|prompt\(' website/src/views/academy website/src/views/instructor website/src/views/customer website/src/views/gyan website/src/views/news website/src/views/channels ; grep -rnE '\?\? [0-9]+' website/src/views/academy website/src/views/instructor website/src/views/customer website/src/views/gyan website/src/views/news website/src/views/channels`
- EXPECT: both greps print nothing.
- IF FAIL: replace each hit with the toast/modal system or a real value path at its source file.
- [ ]

### Task F.6 — Tile sweep: every phase tile resolves
- DO: Verify each toolId delivered by this phase is registered to a real page and routed: `instructorHome`, `courses`, `courseDetail`, `emarketHome`, `orderTracking`, `gyanHub`, `agriNews`, `liveChannels`. Also confirm no reachable "coming soon"/placeholder remains for these ids.
- RUN: `for id in instructorHome courses courseDetail emarketHome orderTracking gyanHub agriNews liveChannels; do grep -rq "$id" website/src/views website/src/components/ToolPage.tsx && echo "$id registered" || echo "$id MISSING"; done ; grep -rniE 'coming soon' website/src/views/academy website/src/views/instructor website/src/views/customer website/src/views/gyan website/src/views/news website/src/views/channels`
- EXPECT: eight `registered` lines; the "coming soon" grep prints nothing.
- IF FAIL: register/route the MISSING id at the workstream task that owned it; if an id resolves to `PlaceholderPage`, STOP and report.
- [ ]

### Task F.7 — X11 coin rules verified
- DO: Re-run the X11 enforcement tests and confirm no cash-redemption path exists.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_academy_learner.py tests/test_gyan_payments.py -q -k "coin or daily or cap" && grep -rniE 'cash.?out|redeem.*cash|cash.*redeem' app/services/coins.py app/routers/gamification.py`
- EXPECT: pytest exit 0 (200/day earn cap, ≤50% redemption, expert-talk +25 under cap all pass); the grep prints nothing (coins never redeemable for cash).
- IF FAIL: fix the failing cap logic at tasks 1.20–1.23 / 4.3–4.4; remove any cash-out path found.
- [ ]

### Task F.8 — M20 acceptance verified by tests
- DO: Re-run the complete WS-06 AI test file.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_academy_ai.py -q`
- EXPECT: exit 0 — covers 24h cache, fallback ordering on shim/outage/flag-off, instructor-confirm-only grading, rubric rejection, learning-path after certificate, `ai_decisions` cost+confidence.
- IF FAIL: fix at the source WS-06 task.
- [ ]

### Task F.9 — Deferral notes present
- DO: Confirm all three dated deferral notes from this phase exist.
- RUN: `grep -n 'pending_review' missing-features/robust.md | head -1 && grep -n 'X16' missing-features/robust.md | head -1 && grep -n 'module 20' missing-features/robust.md | head -1`
- EXPECT: three matches print (course-moderation queue → phase-07 module 27; platform-originated streaming X16; news CMS → phase-07 module 20).
- IF FAIL: write the missing note at tasks 2.33 / 5.10 / 5.11 and re-run.
- [ ]

### Task F.10 — HUMAN CHECK: instructor earns end-to-end (staging)
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` succeeds (staging/dev stack running with Razorpay test keys configured by the human operator).
- DO: HUMAN CHECK: (1) as an instructor, complete KYC credential upload and get the case approved (human operator approves via the phase-00 path); (2) publish a course; (3) as a farmer, purchase it (Razorpay test mode); (4) run the settlement job for the period → an instructor settlement doc shows commission within 15–20%; (5) instructor earnings page shows the same numbers; (6) payout status visible (onHold until bank verified); (7) repeat key screens in Hindi.
- RUN: manual — no command (PRECONDITION curl above).
- EXPECT: the human confirms commission accrued at the configured 15–20% and payout visible.
- IF FAIL: record the broken step + output, fix at the source task, repeat once.
- [ ]

### Task F.11 — HUMAN CHECK: farmer certifies end-to-end
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed.
- DO: HUMAN CHECK: catalog → coins+Razorpay purchase (slider capped) → player to 100% → certificate → open the QR/verification URL in a logged-out browser → public verify page resolves → certificate visible in the farmer profile Skill Passport.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms the whole chain, including the logged-out verify page.
- IF FAIL: record the broken step, fix at the source task, repeat once.
- [ ]

### Task F.12 — HUMAN CHECK: household weekly purchase with escrow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed.
- DO: HUMAN CHECK: create a weekly subscription from 3 favorite farmers → trigger the subscription planner (human runs the job) → orders generated → deposit escrow funded → split shipments tracked → photo inspection → acceptance → escrow release reflected both ways (deposit + penalty matrix was exercised by tasks 3.24/3.25 tests — human confirms the UI reflects each state).
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms escrow protection on both sides across the flow.
- IF FAIL: record the broken step, fix at the source task, repeat once.
- [ ]

### Task F.13 — HUMAN CHECK: gyan, news, channels sweep
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` and `curl -sf http://localhost:5173` succeed.
- DO: HUMAN CHECK: (1) buy a paid workshop with coins (capped slider) + Razorpay; (2) register for an expert talk → +25 coins, daily cap respected; (3) breaking banner → news detail → audio readout; (4) licensed HLS channel plays; moderated chat rejects a phone number; (5) each flow repeated in Hindi.
- RUN: manual — no command (PRECONDITION curls above).
- EXPECT: the human confirms all five checks.
- IF FAIL: record the broken step, fix at the source task, repeat once.
- [ ]

### Task F.14 — Phase-final commit
- DO: Commit the completed phase-04 state.
- RUN: `git add -A && git commit -m "phase-04: knowledge and consumer personas complete"`
- EXPECT: commit succeeds (git identity missing: note it in the report and continue — playbook §6).
- IF FAIL: inspect `git status`, resolve, retry once; else report.
- [ ]
