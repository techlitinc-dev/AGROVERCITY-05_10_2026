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
