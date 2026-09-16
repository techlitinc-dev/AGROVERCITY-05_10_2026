# Day 9 — Farm Diary, P&L, Finance + Landlord Management

**Dev A (Backend) goal:** Diary entries CRUD + PDF report, P&L summary/crops/break-even, finance (credit score, EMI calculator, KCC, loan apply), and the new landlord plots/leases/rent-payment endpoints work with pytest coverage.
**Dev B (Flutter) goal:** `farm_diary_view`, `profit_loss_view`, `finance_view` ported and wired to the API; 3 new landlord screens (plot manage, lease manage, rent tracking) built and routed.

## Dev A — Backend tasks

### Task A1 — Diary entries CRUD + PDF report

- **Goal:** `GET/POST /v1/diary/entries`, `DELETE /v1/diary/entries/{id}`, `GET /v1/diary/report` (PDF → Firebase Storage URL).
- **Depends on:** Day 2 Task A2 (`current_user_id` in `app/core/deps.py`), Day 3 (`require_role`), Day 1 Task A2 (`app/core/db.py` helpers: `get_doc`/`set_doc`/`query`).
- **Files to create/modify:**
  - `backend/app/models/diary.py` (new — Pydantic models)
  - `backend/app/routers/diary.py` (new)
  - `backend/app/services/reports.py` (new — PDF generation + Storage upload)
  - `backend/app/services/coins.py` (new — coin award helper; Day 13 adds the full ledger)
  - `backend/app/main.py` (modify — include router)
  - `backend/requirements.txt` (modify — add `reportlab==4.2.5`)
  - `backend/tests/test_diary.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/diary.py` (field names MUST match `FarmDiaryEntry` in endpoints.md §8):
     - `class DiaryEntryIn(BaseModel)`: `title: str`, `category: str`, `type: Literal["expense", "income", "farmActivity"]`, `amount: float = 0`, `date: str` (YYYY-MM-DD), `cropName: str | None = None`, `notes: str | None = None`
     - `class DiaryEntryOut(DiaryEntryIn)`: + `id: str`
     - `class DiaryEntryCreated(BaseModel)`: `entry: DiaryEntryOut`, `agriCoinsEarned: int`
  2. Write `backend/app/services/coins.py`:
     - `async def award_coins(uid: str, amount: int, reason: str, ref_id: str | None = None) -> int`: load `users/{uid}` via `get_doc`, set `agriCoins = current + amount` via `set_doc` (merge), append a ledger doc to `users/{uid}/coin_ledger` `{ id: uuid4, amount: +amount, reason, refId: ref_id, at: <utc iso> }` via `set_doc`; return new balance. (Full level/streak logic lands Day 13 — keep the signature stable.)
  3. Write `backend/app/routers/diary.py` with `router = APIRouter(prefix="/diary", tags=["diary"])`; every endpoint takes `uid: str = Depends(current_user_id)` then loads the user and calls `require_role(user, "farmer", "farmLandlord")` → 403 `FORBIDDEN_ROLE` otherwise. Data lives in subcollection `users/{uid}/diary_entries`.
     - `GET /entries?type=&category=&from=&to=`: list the subcollection (use a small local helper `list_subdocs(f"users/{uid}/diary_entries")` in the router — `query()` only handles top-level collections), filter in Python by `type`, `category`, and `from`/`to` (inclusive string compare on YYYY-MM-DD), sort by `date` desc. Return pagination envelope `{ "data": [...], "page": 1, "pageSize": 20, "total": N }`.
     - `POST /entries`: validate body; `set_doc(f"users/{uid}/diary_entries", entry_id, {...})` with `entry_id = uuid4().hex`; `new_balance = await award_coins(uid, 15, "diary_entry", entry_id)`; return HTTP 201 `DiaryEntryCreated(entry=..., agriCoinsEarned=15)`.
     - `DELETE /entries/{id}`: 404 `ENTRY_NOT_FOUND` if missing; delete; return 204 (empty body).
  4. Write `backend/app/services/reports.py`:
     - `def build_diary_pdf(uid: str, entries: list[dict], from_date: str, to_date: str) -> str`: reportlab `SimpleDocTemplate` → `/tmp/diary_{uid}_{uuid4().hex[:8]}.pdf`. Title `Farm Diary Report`; table columns Date | Title | Category | Type | Amount (₹); final summary rows: total income, total expense, net. Return the file path.
     - `def upload_to_storage(local_path: str, dest_path: str) -> str`: `firebase_admin.storage.bucket().blob(dest_path)`; `blob.upload_from_filename(local_path)`; `blob.make_public()`; return `blob.public_url`. If `settings.firebase_service_account` is empty (dev mode), return `f"file://{local_path}"` and log a warning instead.
  5. `GET /diary/report?from=&to=` in the router: default range = current calendar month; reuse the list logic; `path = build_diary_pdf(...)`; `url = upload_to_storage(path, f"reports/{uid}/diary_{uuid4().hex[:8]}.pdf")`; return 200 `{ "reportUrl": url, "entryCount": N, "from": ..., "to": ... }`.
  6. In `app/main.py`: `from app.routers import diary` and `app.include_router(diary.router, prefix="/v1")`.
  7. Write `backend/tests/test_diary.py` (reuse mocked-auth fixture pattern from `test_auth.py`; patch `app.core.db` helpers with an in-memory dict store — same approach chosen in Day 2, use consistently):
     - `test_create_entry_awards_15_coins`: POST valid body → 201, `agriCoinsEarned == 15`, user `agriCoins == 15`.
     - `test_list_filters_by_type`: seed expense + income → GET `?type=expense` → only the expense, `total == 1`.
     - `test_delete_entry`: DELETE → 204; GET list → entry gone; second DELETE → 404 `ENTRY_NOT_FOUND`.
     - `test_report_returns_url`: patch `app.services.reports.upload_to_storage` to return `"https://storage.example/x.pdf"` → GET report → 200, `reportUrl == "https://storage.example/x.pdf"`, `entryCount` matches.
     - `test_forbidden_for_seller`: user with `activeProfile == "seller"` → 403 `FORBIDDEN_ROLE`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_diary.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X POST http://localhost:8000/v1/diary/entries -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Urea 1 bag","category":"fertilizer","type":"expense","amount":450,"date":"2026-09-13","cropName":"Wheat"}'` → 201 with `"agriCoinsEarned": 15`; `file /tmp/diary_*.pdf` reports "PDF document".

### Task A2 — P&L endpoints

- **Goal:** `GET /v1/pnl/summary`, `GET /v1/pnl/crops`, `POST /v1/pnl/crops/{id}/expenses`, `POST /v1/pnl/break-even`.
- **Depends on:** Day 9 Task A1 (auth/role pattern).
- **Files to create/modify:**
  - `backend/app/models/pnl.py` (new)
  - `backend/app/routers/pnl.py` (new)
  - `backend/app/data/demo_pnl.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_pnl.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/pnl.py`:
     - `class ExpenseBreakdown(BaseModel)`: `category: str`, `amount: float`
     - `class CropPandL(BaseModel)`: `id: str`, `name: str`, `season: str`, `area: float`, `yieldQuintals: float`, `marketAvgRate: float`, `grossRevenue: float`, `totalExpenses: float`, `netProfit: float`, `roiPercent: float`, `expensesBreakdown: list[ExpenseBreakdown]`
     - `class PnlSummary(BaseModel)`: `grossIncome: float`, `productionCost: float`, `netProfit: float`
     - `class ExpenseIn(BaseModel)`: `category: str`, `amount: float = Field(gt=0)`
     - `class BreakEvenIn(BaseModel)`: `totalCost: float = Field(gt=0)`, `expectedYieldQuintals: float = Field(gt=0)`
     - `class BreakEvenOut(BaseModel)`: `minSafePricePerQuintal: float`
  2. Write `backend/app/data/demo_pnl.py`: 2 demo `CropPandL` dicts copied from the prototype's P&L demo data (`flutter-prototype/lib/data/demo_data.dart` / `app_state.dart`): Wheat (Kharif→Rabi per prototype, area 4.0, yield 40, marketAvgRate 2275, expensesBreakdown seeds/fertilizer/labor/irrigation) and Onion — preserve prototype values exactly so the UI matches.
  3. Write `backend/app/routers/pnl.py` (`prefix="/pnl"`, roles farmer/farmLandlord/seller/equipmentRental/broker via `require_role`). Subcollection `users/{uid}/crop_pnl`.
     - `GET /summary`: sum `grossRevenue` → `grossIncome`, sum `totalExpenses` → `productionCost`, difference → `netProfit`; empty → all zeros. 200.
     - `GET /crops`: list subcollection; **if empty, seed the 2 demo crops first** (set_doc each), then return the envelope.
     - `POST /crops/{id}/expenses`: 404 `CROP_NOT_FOUND` if missing; append `{category, amount}` to `expensesBreakdown`; recompute `totalExpenses = sum(breakdown.amount)`, `netProfit = grossRevenue - totalExpenses`, `roiPercent = round(netProfit / totalExpenses * 100, 1)` (0 when `totalExpenses == 0`); persist; return updated `CropPandL`, 200.
     - `POST /break-even`: pure compute, no DB: `minSafePricePerQuintal = ceil(totalCost / expectedYieldQuintals)`; return `BreakEvenOut`. (Field validation gives 422 for zero/negative yield.)
  4. `app.include_router(pnl.router, prefix="/v1")`.
  5. Write `backend/tests/test_pnl.py`:
     - `test_summary_empty_user_zeros`: → `{grossIncome: 0, productionCost: 0, netProfit: 0}`.
     - `test_crops_seeds_demo_on_first_read`: GET /crops → 2 items, names Wheat + Onion.
     - `test_add_expense_recomputes`: POST expense 5000 to Wheat → `totalExpenses` increased by exactly 5000, `netProfit = grossRevenue - totalExpenses`.
     - `test_break_even_exact`: `{totalCost: 50000, expectedYieldQuintals: 20}` → `{"minSafePricePerQuintal": 2500}`.
     - `test_break_even_zero_yield_422`: yield 0 → 422 envelope.
- **Test:** `cd backend && .venv/bin/pytest tests/test_pnl.py -v`
- **Expected output:** `5 passed`. Manual: `curl -X POST http://localhost:8000/v1/pnl/break-even -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"totalCost":50000,"expectedYieldQuintals":20}'` → 200 `{"minSafePricePerQuintal":2500}`.

### Task A3 — Finance endpoints

- **Goal:** `GET /v1/finance/credit-score`, `POST /v1/finance/loan-calculator`, `GET /v1/finance/kcc`, `POST /v1/finance/loans/apply`.
- **Depends on:** Day 9 Task A1 pattern.
- **Files to create/modify:**
  - `backend/app/models/finance.py` (new)
  - `backend/app/routers/finance.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_finance.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/finance.py`:
     - `class CreditScoreOut(BaseModel)`: `kisanCreditScore: int`, `creditTier: str`, `creditLimit: float`, `factors: list[str]`
     - `class LoanCalcIn(BaseModel)`: `amount: float = Field(ge=5000, le=50000)`, `tenureMonths: int = Field(ge=3, le=12)`, `interestRate: float = 7`
     - `class LoanCalcOut(BaseModel)`: `emi: float`, `totalInterest: float`, `totalPayable: float`
     - `class KccOut(BaseModel)`: `bankName: str`, `cardNumberMasked: str`, `kccLimit: float`, `availableLimit: float`
     - `class LoanApplyIn(BaseModel)`: `amount: float = Field(gt=0)`, `tenureMonths: int = Field(ge=3, le=12)`, `purpose: str`
     - `class LoanApplyOut(BaseModel)`: `applicationId: str`, `status: str`
  2. Write `backend/app/routers/finance.py` (`prefix="/finance"`):
     - `GET /credit-score` (all roles): read `kisanCreditScore`, `creditTier` from user doc (defaults 650 / `"Silver"` when unset); `creditLimit` from tier map `{"Bronze": 25000, "Silver": 50000, "Gold": 100000, "Platinum": 200000}`; `factors = ["Timely KCC repayment", "Crop insurance coverage", "3-season income history"]`. 200.
     - `POST /loan-calculator` (all roles): `r = interestRate / 12 / 100`; `emi = amount * r * (1+r)**n / ((1+r)**n - 1)`; round emi to 2 dp; `totalPayable = round(emi * n, 2)`; `totalInterest = round(totalPayable - amount, 2)`. No DB.
     - `GET /kcc` (role farmer): read `bankName`, `kccLimit`; if `kccLimit` unset/0 → 404 `KCC_NOT_FOUND`; `cardNumberMasked = "XXXX-XXXX-" + phone[-4:]`; `availableLimit = kccLimit` (no utilization ledger in v1). 200.
     - `POST /loans/apply` (role farmer): `set_doc("loan_applications", uuid, {**body, "userId": uid, "status": "submitted", "createdAt": iso})`; 201 `LoanApplyOut(applicationId=uuid, status="submitted")`.
  3. `app.include_router(finance.router, prefix="/v1")`.
  4. Write `backend/tests/test_finance.py`:
     - `test_credit_score_defaults`: fresh user → `kisanCreditScore == 650`, `creditTier == "Silver"`, `creditLimit == 50000`.
     - `test_emi_exact`: `{amount: 25000, tenureMonths: 6, interestRate: 7}` → `emi ≈ 4256.44` (assert `abs(emi - 4256.44) < 0.5`), `totalInterest == round(totalPayable - 25000, 2)`.
     - `test_amount_below_min_422`: amount 4000 → 422; tenure 13 → 422.
     - `test_kcc_not_found`: user without kccLimit → 404 `KCC_NOT_FOUND`.
     - `test_loan_apply`: → 201, `applicationId` non-empty, `status == "submitted"`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_finance.py -v`
- **Expected output:** `5 passed`.

### Task A4 — Landlord: plots, leases, rent payments (NEW endpoints)

- **Goal:** New module — `/v1/land/plots` CRUD, `/v1/land/leases` CRUD, `POST/GET /v1/land/leases/{id}/payments`.
- **Depends on:** Day 9 Task A1 pattern.
- **Files to create/modify:**
  - `backend/app/models/land.py` (new)
  - `backend/app/routers/land.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_land.py` (new)
  - `endpoints.md` (modify — append section "21. Landlord Land Management", same table format as other sections)
- **Subtasks:**
  1. Write `backend/app/models/land.py` (new module — define exactly these fields):
     - `class PlotIn(BaseModel)`: `name: str`, `village: str`, `district: str`, `areaAcres: float = Field(gt=0)`, `gatNumber: str | None = None`, `soilType: str | None = None`
     - `class PlotOut(PlotIn)`: + `id: str`, `status: Literal["vacant", "leased"]`
     - `class LeaseIn(BaseModel)`: `plotId: str`, `tenantName: str`, `tenantPhone: str`, `monthlyRentRupees: float = Field(gt=0)`, `startDate: str`, `endDate: str`
     - `class LeaseOut(LeaseIn)`: + `id: str`, `status: Literal["active", "ended"]`, `verified: bool = False`
     - `class RentPaymentIn(BaseModel)`: `amountRupees: float = Field(gt=0)`, `month: str = Field(pattern=r"^\d{4}-\d{2}$")`, `method: Literal["cash", "upi", "bank"]`, `paidAt: str`
     - `class RentPaymentOut(RentPaymentIn)`: + `id: str`, `leaseId: str`
  2. Firestore layout: `users/{uid}/land_plots/{plotId}`; `users/{uid}/land_leases/{leaseId}`; payments in subcollection `users/{uid}/land_leases/{leaseId}/payments/{paymentId}`.
  3. Write `backend/app/routers/land.py` (`prefix="/land"`, roles farmer + farmLandlord via `require_role`):
     - `GET /plots` → envelope. `POST /plots` → 201 with `status: "vacant"`. `PUT /plots/{id}` → partial update of PlotIn fields (exclude_unset), 404 `PLOT_NOT_FOUND`. `DELETE /plots/{id}` → if any lease with `plotId == id` and `status == "active"` exists → 409 `PLOT_HAS_ACTIVE_LEASE`; else delete, 204.
     - `GET /leases?status=` → envelope, optional `active|ended` filter. `POST /leases` → plot must exist (404 `PLOT_NOT_FOUND`); `endDate > startDate` else 422; create with `status: "active"`, `verified: False`; set plot `status: "leased"`; 201.
     - `PUT /leases/{id}` → allow `monthlyRentRupees`, `endDate`, `status`, `verified`; when `status` becomes `"ended"` set plot back to `"vacant"`. `DELETE /leases/{id}` → 204; if it was active, revert plot status.
     - `POST /leases/{id}/payments` → lease must exist (404 `LEASE_NOT_FOUND`); if a payment with the same `month` already exists for this lease → 409 `DUPLICATE_PAYMENT_MONTH`; write subdoc; 201 `RentPaymentOut`.
     - `GET /leases/{id}/payments` → payments sorted by `month` desc in envelope, plus top-level `totalCollectedRupees` (sum) and `pendingMonths` (list of `YYYY-MM` from lease `startDate` month through current month with no payment).
  4. `app.include_router(land.router, prefix="/v1")`.
  5. Append to `endpoints.md` a section 21 table with these 8 routes, request/response fields as defined above, roles `farmer, farmLandlord`.
  6. Write `backend/tests/test_land.py`:
     - `test_create_plot_vacant`: → 201, `status == "vacant"`.
     - `test_create_lease_marks_plot_leased`: POST lease → 201 `status == "active"`; GET plots → that plot `"leased"`.
     - `test_payment_and_duplicate_month_409`: POST payment month `2026-09` → 201; repeat → 409 `DUPLICATE_PAYMENT_MONTH`.
     - `test_payments_summary`: after 2 payments, GET → `totalCollectedRupees` == sum, `pendingMonths` contains an unpaid past month.
     - `test_delete_plot_with_active_lease_409`: → 409 `PLOT_HAS_ACTIVE_LEASE`.
     - `test_end_lease_frees_plot`: PUT lease `status: "ended"` → plot back to `"vacant"`.
     - `test_lease_bad_dates_422`: endDate < startDate → 422.
- **Test:** `cd backend && .venv/bin/pytest tests/test_land.py -v`
- **Expected output:** `7 passed`. Manual: `curl -X POST http://localhost:8000/v1/land/leases -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"plotId":"<PLOT_ID>","tenantName":"Sunil Pawar","tenantPhone":"+919822211122","monthlyRentRupees":8000,"startDate":"2026-07-01","endDate":"2027-06-30"}'` → 201 `"status": "active"`.

## Dev B — Flutter tasks

### Task B1 — Port Farm Diary view

- **Goal:** Port `farm_diary_view.dart` wired to `/v1/diary/*`.
- **Depends on:** Day 3 Task B1 (`apps/mobile/lib/api/api_client.dart` with `get/post/del`, auth header, `ApiException(code, message)`). API dependency: Day 9 Task A1.
- **Files to create/modify:**
  - `apps/mobile/lib/views/farm_diary_view.dart` (modify — copy from `flutter-prototype/lib/views/farm_diary_view.dart`)
  - `apps/mobile/lib/models/farm_diary_entry.dart` (new)
  - `apps/mobile/lib/api/diary_api.dart` (new)
  - `apps/mobile/test/farm_diary_view_test.dart` (new)
- **Subtasks:**
  1. Copy the prototype view; keep ALL styling/animations/Hindi strings verbatim. Fix package imports.
  2. `farm_diary_entry.dart`: `FarmDiaryEntry.fromJson` for `{id, title, category, type, amount, date, cropName, notes}`.
  3. `diary_api.dart`: `listEntries({type, category, from, to})` (parse envelope `data`), `addEntry(FarmDiaryEntry)` → returns `(entry, agriCoinsEarned)`, `deleteEntry(String id)`, `getReportUrl({from, to})`.
  4. Replace `AppState.diaryEntries` reads with `FutureBuilder` on `DiaryApi.listEntries`; replace add/delete mutations with API calls followed by refetch. After add, SnackBar `+15 AgriCoins मिले!` using the response value.
  5. "PDF रिपोर्ट" button → `getReportUrl` → `url_launcher` `launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)` (add `url_launcher: ^6.3.0` to `apps/mobile/pubspec.yaml`).
  6. Loading state: centered `CircularProgressIndicator(color: Color(0xFF43A047))`; error state: `डेटा लोड नहीं हो सका` + retry button that refetches.
  7. `apps/mobile/test/farm_diary_view_test.dart`:
     - `testWidgets('farm diary renders summary and entry list', ...)` — fake api returns 2 entries; expect summary labels `आय`, `खर्च` and one entry title.
     - `testWidgets('add entry awards coins snackbar', ...)` — submit the add dialog with fake returning `agriCoinsEarned: 15`; expect SnackBar text `+15 AgriCoins मिले!`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/farm_diary_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: add entry → appears with coin SnackBar; delete → row gone; PDF button opens the report URL.

### Task B2 — Port Profit & Loss view

- **Goal:** Port `profit_loss_view.dart` wired to `/v1/pnl/*`.
- **Depends on:** Day 9 Task B1. API dependency: Day 9 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/views/profit_loss_view.dart` (modify — port from `flutter-prototype/lib/views/profit_loss_view.dart`)
  - `apps/mobile/lib/models/crop_pnl.dart` (new)
  - `apps/mobile/lib/api/pnl_api.dart` (new)
  - `apps/mobile/test/profit_loss_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — 3 KPI cards, crop selector pills, per-crop statement, expense breakdown, add-expense dialog, break-even calculator.
  2. `crop_pnl.dart`: `CropPandL.fromJson` for the exact A2 fields incl. `expensesBreakdown[{category, amount}]`.
  3. `pnl_api.dart`: `getSummary()`, `getCrops()`, `addExpense(cropId, category, amount)`, `breakEven(totalCost, expectedYieldQuintals)`.
  4. KPI cards ← `getSummary()`; per-crop statement ← selected item from `getCrops()`; add-expense dialog → `addExpense` → replace selected crop with response (no full refetch needed); break-even calculator → call `breakEven` on slider `onChangeEnd` (NOT on every drag tick) and show the returned price in the prototype's result label (copy its exact text).
  5. `apps/mobile/test/profit_loss_view_test.dart`:
     - `testWidgets('pnl renders 3 KPI cards', ...)` — fake summary `{grossIncome: 145000, productionCost: 62000, netProfit: 83000}`; expect the 3 KPI cards with ₹-formatted values.
     - `testWidgets('break even shows result', ...)` — fake `breakEven` returns 2500; move slider to end → expect `2,500` visible.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/profit_loss_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass; manual: add expense → net profit decreases immediately.

### Task B3 — Port Finance view

- **Goal:** Port `finance_view.dart` wired to `/v1/finance/*`.
- **Depends on:** Day 9 Task B1. API dependency: Day 9 Task A3.
- **Files to create/modify:**
  - `apps/mobile/lib/views/finance_view.dart` (modify — port from `flutter-prototype/lib/views/finance_view.dart`)
  - `apps/mobile/lib/api/finance_api.dart` (new)
  - `apps/mobile/test/finance_view_test.dart` (new)
- **Subtasks:**
  1. Copy the view verbatim — credit-score card, loan calculator (₹5k–50k / 3–12 months sliders), KCC card visual.
  2. `finance_api.dart`: `getCreditScore()`, `calcEmi(amount, tenureMonths)`, `getKcc()`, `applyLoan(amount, tenureMonths, purpose)`.
  3. Credit-score card ← `getCreditScore()` (score, tier, limit, factors list).
  4. EMI calculator: call `calcEmi` on slider `onChangeEnd`; display `emi`, `totalInterest`, `totalPayable` from the API. Offline fallback: wrap in try/catch — on failure compute locally with the same formula and show it without error UI.
  5. KCC card ← `getKcc()`; on `ApiException(code: 'KCC_NOT_FOUND')` show placeholder `KCC जुड़ा नहीं है` + "Apply" button → `applyLoan(amount: kccDefault, tenureMonths: 12, purpose: 'KCC application')` → on 201 SnackBar `आवेदन जमा हुआ`.
  6. `apps/mobile/test/finance_view_test.dart`:
     - `testWidgets('finance renders credit score card', ...)` — fake score 785/Gold/100000; expect `785` and tier text.
     - `testWidgets('emi updates from api', ...)` — fake returns emi 4256.44; expect it rendered after slider settle.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/finance_view_test.dart`
- **Expected output:** `No issues found!`; 2 tests pass.

### Task B4 — NEW landlord screens (plots, leases, rent)

- **Goal:** 3 new screens hitting `/v1/land/*`, reachable from the landlord home quick actions.
- **Depends on:** Day 8 landlord home port (`apps/mobile/lib/views/profile_home/landlord_home_view.dart`). API dependency: Day 9 Task A4.
- **Files to create/modify:**
  - `apps/mobile/lib/views/landlord/plot_manage_view.dart` (new screen)
  - `apps/mobile/lib/views/landlord/lease_manage_view.dart` (new screen)
  - `apps/mobile/lib/views/landlord/rent_tracking_view.dart` (new screen)
  - `apps/mobile/lib/api/land_api.dart` (new)
  - `apps/mobile/lib/models/land_models.dart` (new)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — routes `landlordPlots`, `landlordLeases`, `landlordRent` for farmer + farmLandlord)
  - `apps/mobile/lib/views/profile_home/landlord_home_view.dart` (modify — quick action `प्लॉट और पट्टे` → `landlordPlots`)
  - `apps/mobile/test/landlord_views_test.dart` (new)
- **Subtasks:**
  1. `land_api.dart`: `listPlots/createPlot/updatePlot/deletePlot`, `listLeases({status})/createLease/updateLease/deleteLease`, `addPayment(leaseId, ...)`, `listPayments(leaseId)` — exact A4 contracts.
  2. `land_models.dart`: `LandPlot`, `LandLease`, `RentPayment` `fromJson` per A4 (`areaAcres`, `monthlyRentRupees`, `amountRupees`, `pendingMonths`, `totalCollectedRupees`…).
  3. `plot_manage_view.dart`: app bar `मेरे प्लॉट`; plot cards (name, village, `areaAcres` acres, status chip — leased = purple `Color(0xFF8B5CF6)` `पट्टे पर`, vacant = green `खाली`); FAB `+ नया प्लॉट` → bottom-sheet form (name, village, district, areaAcres number field, optional gatNumber, soilType chips Black Cotton/Red/Sandy/Alluvial) → `createPlot`; long-press card → confirm dialog `प्लॉट हटाएं?` → `deletePlot`; on `PLOT_HAS_ACTIVE_LEASE` SnackBar `सक्रिय पट्टा मौजूद है — पहले पट्टा समाप्त करें`.
  4. `lease_manage_view.dart`: app bar `पट्टे`; filter chips `सक्रिय`/`समाप्त` → `?status=active|ended`; lease cards (tenantName, plot name, `₹{monthlyRentRupees}/माह`, date range, `सत्यापित` badge when verified); FAB `+ नया पट्टा` bottom sheet: plot dropdown (vacant plots from `listPlots`), tenantName, tenantPhone (10-digit validation), monthlyRentRupees, start/end date pickers → `createLease`; overflow menu → `पट्टा समाप्त करें` → `updateLease(status: 'ended')` with confirm. Tap card → push `rent_tracking_view` with the lease.
  5. `rent_tracking_view.dart`: app bar `{tenantName} — किराया`; header card `कुल संग्रह: ₹{totalCollectedRupees}`; section `लंबित महीने` → `pendingMonths` as red chips; payments list (month, `₹{amountRupees}`, method, paidAt); FAB `+ भुगतान दर्ज करें` bottom sheet: month picker (YYYY-MM), amount prefilled with `monthlyRentRupees`, method chips नकद/UPI/बैंक → `addPayment`; on `DUPLICATE_PAYMENT_MONTH` SnackBar `इस महीने का भुगतान पहले से दर्ज है`.
  6. Register the 3 routes in `profile_routes.dart` for `farmer` and `farmLandlord`; wire the landlord-home quick action.
  7. `apps/mobile/test/landlord_views_test.dart`:
     - `testWidgets('plot manage renders plot list', ...)` — fake 2 plots (one leased, one vacant); expect both names + chips `पट्टे पर` and `खाली`.
     - `testWidgets('rent tracking shows pending months', ...)` — fake `pendingMonths: ['2026-08']`, `totalCollectedRupees: 16000`; expect chip `2026-08` and header `कुल संग्रह`.
     - `testWidgets('lease manage filter chips render', ...)` — expect `सक्रिय` and `समाप्त`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/landlord_views_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: create plot → create lease → record payment → duplicate-month SnackBar; end lease → plot shows `खाली`.

## Done-when checklist (end of day)

- [ ] `cd backend && .venv/bin/pytest tests/test_diary.py tests/test_pnl.py tests/test_finance.py tests/test_land.py -v` → 22 passed; full suite green.
- [ ] Diary report returns a Storage URL (dev mode `file://` acceptable with warning log); generated file is a valid PDF.
- [ ] P&L demo crops seed on first read; expense add recomputes totals exactly; break-even math verified (50000/20 → 2500).
- [ ] EMI math verified (25000/6mo/7% → ~4256.44); KCC 404 path; loan apply 201.
- [ ] Landlord rules verified: duplicate payment month 409, delete-plot-with-lease 409, lease end frees plot.
- [ ] `endpoints.md` section 21 appended for the 8 new landlord routes.
- [ ] `flutter analyze` 0 issues; 9 new widget tests pass.
- [ ] farm_diary / profit_loss / finance render identically to prototype but load from API (kill backend → error state + retry).
- [ ] Landlord screens reachable from landlord home; full plot→lease→payment flow works on emulator.

---

## Additional tasks (from missing.md)

Covers: F16 bank accounts, F17 loan tracking, X10/T5/E6/B6 settlement engine, L2 land listings, L3 lease requests, L4 agreement PDF. Endpoint/screen specs land in `docs/overview/03` Parts C–D — where anything below diverges, the spec item wins (Spec: docs/overview/03 Part C/D item `<ID>`).

### Task A5 — Bank accounts: CRUD + penny-drop verify + set primary (F16)

- **Goal:** `GET/POST /v1/bank-accounts`, `DELETE /v1/bank-accounts/{id}`, `POST /v1/bank-accounts/{id}/verify`, `POST /v1/bank-accounts/{id}/set-primary`. Spec: docs/overview/03 Part C item F16.
- **Depends on:** Day 9 Task A1 pattern; adapter pattern from Day 10 Task A3.
- **Files to create/modify:**
  - `backend/app/models/bank_accounts.py` (new)
  - `backend/app/routers/bank_accounts.py` (new)
  - `backend/app/services/bank_verify/base.py` + `stub.py` + `__init__.py` (new — penny-drop adapter, env `BANK_VERIFY_ADAPTER`, default `stub`)
  - `backend/app/main.py` (modify — include router)
  - `backend/tests/test_bank_accounts.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/bank_accounts.py`:
     - `class BankAccountIn(BaseModel)`: `accountHolder: str = Field(min_length=3)`, `accountNumber: str = Field(pattern=r"^\d{9,18}$")`, `ifsc: str = Field(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")`, `bankName: str`
     - `class BankAccountOut(BaseModel)`: `id: str`, `accountHolder: str`, `accountNumberMasked: str` (`"XXXX" + accountNumber[-4:]` — the full number NEVER appears in a response), `ifsc: str`, `bankName: str`, `isPrimary: bool`, `verifyStatus: Literal["unverified", "pending", "verified", "failed"]`, `createdAt: str`
  2. Firestore: `users/{uid}/bank_accounts/{id}` stores the full `accountNumber`. Module docstring (same wording family as the Day 10 vault note): "Encryption at rest is provided by Firestore (AES-256/GMEK by default). Never log full account numbers — log the masked form only." Add `# never log full account numbers` above every logger call in this router.
  3. `bank_verify/base.py`: `class BankVerifyAdapter(ABC): async def penny_drop(self, account_number: str, ifsc: str, account_holder: str) -> dict` returning `{verified: bool, accountHolderMatch: bool}`. `stub.py` returns `{"verified": True, "accountHolderMatch": True}` (mocked success). `__init__.py`: `get_bank_verify_adapter()` via `BANK_VERIFY_ADAPTER` (default stub; the real penny-drop provider — Razorpay/Cashfree — lands later; routers never change).
  4. Write `backend/app/routers/bank_accounts.py` (`router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])`, all roles via `current_user_id` — every earning persona needs a payout account):
     - `GET /`: list own accounts, primary first; pagination envelope.
     - `POST /`: create with `verifyStatus: "unverified"`; the user's **first** account becomes `isPrimary: true` automatically, later ones `false`; 201 `BankAccountOut`.
     - `POST /{id}/verify`: 404 `BANK_ACCOUNT_NOT_FOUND` if missing/foreign; set `verifyStatus: "pending"`, call the adapter, then `verified` (or `failed` when `verified: false`); 200 with the updated account.
     - `POST /{id}/set-primary`: unset `isPrimary` on the user's other accounts, set it here; 200 `{ "primaryId": id }`.
     - `DELETE /{id}`: 404 `BANK_ACCOUNT_NOT_FOUND`; delete; if it was primary, promote the oldest remaining account; 204.
  5. Downstream reference: patch `POST /insurance/claims` (Day 11) so `bankAccountLast4` comes from the user's primary verified bank account when one exists (phone last-4 fallback otherwise); loan disbursal (Task A6) and Task A7 settlement payouts assume the primary account (display-only in v1).
  6. `app.include_router(bank_accounts.router, prefix="/v1")`.
  7. Write `backend/tests/test_bank_accounts.py`:
     - `test_first_account_becomes_primary`: POST → 201, `isPrimary == True`, `verifyStatus == "unverified"`, `accountNumberMasked` ends with the last 4 digits and leaks no other digits.
     - `test_bad_ifsc_422` / `test_short_account_number_422`: invalid IFSC / 5-digit number → 422.
     - `test_verify_stub_success`: verify → 200, `verifyStatus == "verified"`.
     - `test_set_primary_flips_flags`: 2 accounts → set-primary on the second → first becomes `isPrimary == False`.
     - `test_delete_primary_promotes_oldest`: delete the primary → oldest remaining account becomes primary.
     - `test_foreign_account_404`: user B cannot verify/delete user A's account.
     - `test_claim_uses_primary_account_last4`: seed a verified primary account → POST claim (Day 11 flow) → `bankAccountLast4` == account last-4, not phone last-4.
- **Test:** `cd backend && .venv/bin/pytest tests/test_bank_accounts.py -v`
- **Expected output:** `7 passed`. Manual: `curl -X POST http://localhost:8000/v1/bank-accounts -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"accountHolder":"Ram Singh","accountNumber":"12345678901","ifsc":"SBIN0001234","bankName":"SBI"}'` → 201 with masked number; then `curl -X POST http://localhost:8000/v1/bank-accounts/<ID>/verify -H "Authorization: Bearer $TOKEN"` → `"verifyStatus": "verified"`.

### Task A6 — Loan application status list (F17)

- **Goal:** `GET /v1/finance/loans` — the farmer sees "submitted → underReview → approved → disbursed" progression. Spec: docs/overview/03 Part C item F17.
- **Depends on:** Day 9 Task A3 (`loan_applications` collection).
- **Files to create/modify:**
  - `backend/app/models/finance.py` (modify — add `LoanApplicationOut`)
  - `backend/app/routers/finance.py` (modify — add route)
  - `backend/tests/test_finance.py` (modify — append 2 tests)
- **Subtasks:**
  1. `class LoanApplicationOut(BaseModel)`: `applicationId: str`, `amount: float`, `tenureMonths: int`, `purpose: str`, `status: Literal["submitted", "underReview", "approved", "disbursed", "rejected"]`, `createdAt: str`.
  2. `GET /loans` (role farmer): `query("loan_applications", [("userId", "==", uid)])`, sort `createdAt` desc, pagination envelope. Empty list is a valid 200 — no 404s.
  3. Tests: `test_loans_list_after_apply` (apply → GET → 1 item, `status == "submitted"`); `test_loans_empty_list_200` (fresh user → `data == []`).
- **Test:** `cd backend && .venv/bin/pytest tests/test_finance.py -v`
- **Expected output:** `7 passed` (5 existing + 2 new).

### Task A7 — Platform settlement engine (X10 + T5/E6/B6)

- **Goal:** `settlements` collection + nightly job `POST /v1/jobs/settlements/run` + per-persona list endpoints `/v1/transport/settlements`, `/v1/equipment/settlements`, `/v1/broker/settlements`. Spec: docs/overview/03 Part C item X10 (T5/E6/B6 consume it).
- **Depends on:** Day 7 (`transport_bookings` with `fare`), Day 8 (`equipment_bookings`), the broker-deals collection from the Day 6/7 broker router (use whatever collection name those days established), Day 9 Task A5 (payout account).
- **Files to create/modify:**
  - `backend/app/models/settlements.py` (new)
  - `backend/app/services/settlements.py` (new)
  - `backend/app/routers/settlements.py` (new — persona lists)
  - `backend/app/routers/jobs.py` (new — cron-triggered job endpoints live here from now on)
  - `backend/app/main.py` (modify — include both routers)
  - `backend/tests/test_settlements.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/settlements.py`:
     - `class SettlementOut(BaseModel)`: `id: str`, `role: Literal["transport", "equipmentRental", "broker"]`, `entityId: str` (the earning user's uid), `periodStart: str`, `periodEnd: str` (YYYY-MM-DD), `grossRupees: int`, `commissionRupees: int`, `netRupees: int` (whole rupees per conventions §8), `status: Literal["pending", "approved", "paid"]`, `sourceIds: list[str]`, `createdAt: str`
     - `class SettlementRunIn(BaseModel)`: `periodStart: str | None = None`, `periodEnd: str | None = None`
  2. Commission config: doc `platform_config/settlements` `{ "transportPct": 10, "equipmentRentalPct": 12, "brokerPct": 2 }`, seeded on first read; the service reads it on every run (no hardcoded percentages).
  3. Write `backend/app/services/settlements.py`: `async def run_settlements(period_start: str, period_end: str) -> dict` — aggregate `transport_bookings` with `status == "delivered"` in the period (sum `fare`), completed `equipment_bookings` (sum `priceRupees`), broker deals `status == "completed"` (sum deal value); group by earner uid; upsert one settlement per `(role, entityId, periodStart)` — doc id `st_{role}_{entityId[:8]}_{periodStart}` so a rerun never duplicates: recompute amounts while `status == "pending"`, leave `approved`/`paid` rows untouched. Return `{ "created": n, "updated": n }`.
  4. Write `backend/app/routers/jobs.py` (`prefix="/jobs"`, no user auth): `POST /settlements/run` — header `X-Cron-Secret` must equal `settings.cron_secret` (env `CRON_SECRET`; empty in dev mode = allow with a warning log) else 401 `CRON_UNAUTHORIZED`; body `SettlementRunIn`, default period = the last ISO week (Mon–Sun); 200 with the run summary. Comment in the module: Cloud Scheduler hits this nightly (`0 22 * * *` IST) with the secret header — scheduler setup belongs to `docs/deployment/backend-deploy.md`.
  5. Write `backend/app/routers/settlements.py`: `GET /transport/settlements` (role transport), `GET /equipment/settlements` (equipmentRental), `GET /broker/settlements` (broker) — each returns only `entityId == uid` rows, newest period first, envelope. Other personas → 403 `FORBIDDEN_ROLE`. Admin approve/mark-paid lands Day 14 (A5 console); today's job creates `pending` rows only.
  6. `app.include_router` for both routers with `prefix="/v1"`.
  7. Write `backend/tests/test_settlements.py`:
     - `test_job_aggregates_transport_fares`: 2 delivered bookings (₹800 + ₹1200) → one settlement `grossRupees == 2000`, `commissionRupees == 200` (10%), `netRupees == 1800`, `status == "pending"`.
     - `test_job_idempotent_rerun`: second run → `created == 0`, still one settlement doc.
     - `test_cron_secret_required`: with `CRON_SECRET` set, missing/wrong header → 401 `CRON_UNAUTHORIZED`.
     - `test_persona_scoping`: transporter sees only own rows; farmer calling `/v1/transport/settlements` → 403 `FORBIDDEN_ROLE`.
     - `test_pending_recomputed_approved_untouched`: approve a row, add another delivered booking, rerun → approved row unchanged, other pending rows recomputed.
- **Test:** `cd backend && .venv/bin/pytest tests/test_settlements.py -v`
- **Expected output:** `5 passed`. Manual: seed delivered bookings, `curl -X POST http://localhost:8000/v1/jobs/settlements/run -H "X-Cron-Secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{}'` → `{ "created": 1, ... }`; `curl http://localhost:8000/v1/transport/settlements -H "Authorization: Bearer $TOKEN"` shows the row.

### Task A8 — Land listings marketplace + lease requests + agreement PDF (L2, L3, L4)

- **Goal:** `/v1/land/listings` CRUD + nearby browse, `/v1/land/lease-requests` request/accept/reject, `GET /v1/land/leases/{id}/agreement-pdf`. Spec: docs/overview/03 Part C items L2–L4.
- **Depends on:** Day 9 Task A4 (`land_plots`/`land_leases`), Day 9 Task A1 (`app/services/reports.py` PDF + upload helpers).
- **Files to create/modify:**
  - `backend/app/models/land.py` (modify — listing + request models)
  - `backend/app/routers/land.py` (modify — new routes)
  - `backend/app/services/reports.py` (modify — `build_lease_agreement_pdf`)
  - `backend/tests/test_land_market.py` (new)
  - `endpoints.md` (modify — extend section 21 with the new routes)
- **Subtasks:**
  1. Extend `backend/app/models/land.py`:
     - `class LandListingIn(BaseModel)`: `village: str`, `district: str`, `lat: float`, `lng: float`, `areaAcres: float = Field(gt=0)`, `expectedRentRupees: float = Field(gt=0)`, `soilType: str | None = None`, `waterSource: str | None = None`, `plotId: str | None = None`
     - `class LandListingOut(LandListingIn)`: + `id: str`, `landlordId: str`, `landlordName: str`, `status: Literal["open", "leased", "closed"]`, `createdAt: str`
     - `class LeaseRequestIn(BaseModel)`: `listingId: str`, `message: str = ""`, `durationMonths: int = Field(ge=1, le=120)`
     - `class LeaseRequestOut(LeaseRequestIn)`: + `id: str`, `farmerId: str`, `farmerName: str`, `farmerPhone: str`, `landlordId: str`, `status: Literal["pending", "accepted", "rejected"]`, `createdAt: str`
  2. New top-level collections `land_listings` (farmers browse other landlords' listings) and `lease_requests`. Add to `backend/app/routers/land.py`:
     - `POST /land/listings` (role farmLandlord): optional `plotId` must be an own plot (404 `PLOT_NOT_FOUND`); create `status: "open"`, `landlordName` from the user doc; 201.
     - `GET /land/listings?near=<lat>,<lng>&acres=` (roles farmer, farmLandlord): open listings; `near` → haversine filter ≤ 25 km over the result set; `acres` → `areaAcres >= acres`; envelope.
     - `GET /land/listings/mine` (farmLandlord): own listings in any status; envelope. `PUT /land/listings/{id}` / `DELETE /land/listings/{id}`: owner only (403 `NOT_LISTING_OWNER`); DELETE while `status == "leased"` → 409 `LISTING_HAS_ACTIVE_LEASE`.
     - `POST /land/lease-requests` (role farmer): listing must exist (404 `LISTING_NOT_FOUND`) and be open (409 `LISTING_NOT_OPEN`); one pending request per farmer per listing → 409 `DUPLICATE_LEASE_REQUEST`; write with `landlordId`, farmer name/phone from the user doc; 201.
     - `GET /land/lease-requests?status=` (farmLandlord): requests on own listings; envelope.
     - `POST /land/lease-requests/{id}/accept` (landlord owner, else 403 `NOT_LISTING_OWNER`): pending only (409 `REQUEST_ALREADY_RESOLVED`); create the lease reusing Task A4 logic (tenantName/tenantPhone from the farmer's user doc, `monthlyRentRupees = listing.expectedRentRupees`, term = `durationMonths` from today), set listing `status: "leased"`, mark the listing's other pending requests rejected with reason `Listed plot leased to another farmer`; 200 `{ "leaseId": id }`.
     - `POST /land/lease-requests/{id}/reject` (landlord owner): body `{ "reason": str = "" }`; 200 `{ "status": "rejected" }`.
  3. L4 — `GET /land/leases/{id}/agreement-pdf` (the landlord who owns the lease, or the tenant farmer whose phone matches `tenantPhone`; otherwise 404 `LEASE_NOT_FOUND`): add `build_lease_agreement_pdf(lease, landlord, tenant) -> str` to `app/services/reports.py` — reportlab PDF with both-party data: Hindi heading `कृषि भूमि पट्टा अनुबंध`, landlord name/village, plot name + gatNumber, tenant name/phone, monthly rent, start/end dates, generated-on date; upload via `upload_to_storage(path, f"agreements/{uid}/{lease_id}.pdf")`; 200 `{ "agreementUrl": url }`.
  4. Append the 9 new routes to `endpoints.md` section 21 (same table format).
  5. Write `backend/tests/test_land_market.py`:
     - `test_create_and_browse_near_filter`: landlord creates 2 listings (one 5 km away, one 100 km away) → farmer `?near=` sees only the near one.
     - `test_duplicate_request_409`: same farmer requests twice → 409 `DUPLICATE_LEASE_REQUEST`.
     - `test_accept_creates_lease_and_flips_listing`: accept → 200 with `leaseId`; listing `status == "leased"`; lease exists via `GET /land/leases`; other pending requests on the listing auto-rejected.
     - `test_non_owner_accept_403`: another landlord → 403 `NOT_LISTING_OWNER`.
     - `test_agreement_pdf_returns_url`: patch `upload_to_storage` → 200 with `agreementUrl`; generated file is a valid PDF.
     - `test_tenant_can_fetch_agreement`: the tenant farmer (matching phone) → 200; unrelated user → 404 `LEASE_NOT_FOUND`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_land_market.py -v`
- **Expected output:** `6 passed`. Manual: landlord `POST /v1/land/listings` → farmer `GET ?near=20.0,73.8` sees it → `POST /v1/land/lease-requests` → landlord accept → `GET /v1/land/leases/<ID>/agreement-pdf` returns a URL.

### Task B5 — Bank accounts view (F16)

- **Goal:** `bank_accounts_view.dart` — list / add / verify badge / set primary — linked from the Finance and Crop Insurance screens. Spec: docs/overview/03 Part D item F16. API dependency: Day 9 Task A5.
- **Depends on:** Day 9 Task B1 (api client), Day 9 Task A5.
- **Files to create/modify:**
  - `apps/mobile/lib/views/bank_accounts_view.dart` (new screen)
  - `apps/mobile/lib/api/bank_accounts_api.dart` (new)
  - `apps/mobile/lib/models/bank_account.dart` (new)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `bankAccounts`, all 6 personas)
  - `apps/mobile/lib/views/finance_view.dart` (modify — entry tile)
  - `apps/mobile/lib/views/crop_insurance_view.dart` (modify — DBT account row entry, placeholder until Day 11 port lands)
  - `apps/mobile/test/bank_accounts_view_test.dart` (new)
- **Subtasks:**
  1. `bank_accounts_api.dart`: `listAccounts()`, `addAccount(holder, accountNumber, ifsc, bankName)`, `verifyAccount(id)`, `setPrimary(id)`, `deleteAccount(id)` — exact A5 contracts.
  2. `bank_account.dart`: `BankAccount.fromJson` for the A5 fields (`accountNumberMasked`, `isPrimary`, `verifyStatus`).
  3. View: app bar `बैंक खाते`; account cards (bankName, masked number, IFSC, holder) with a primary star + label `प्राथमिक` and a verify chip — verified = green `सत्यापित ✓`, pending = amber `सत्यापन लंबित`, unverified = grey `असत्यापित` with a `सत्यापित करें` button → `verifyAccount` → refetch; overflow menu on non-primary cards → `प्राथमिक बनाएं` → `setPrimary`; long-press → confirm `खाता हटाएं?` → `deleteAccount`.
  4. FAB `+ खाता जोड़ें` bottom-sheet form: holder name, account number (digits-only keyboard, 9–18), IFSC (auto-uppercase; client-side regex → inline `IFSC अमान्य` without an API call), bank name → `addAccount` → on 201 SnackBar `खाता जोड़ा गया` + refetch.
  5. Entries: `finance_view` quick tile `बैंक खाते` → route; crop-insurance DBT info row `भुगतान खाता` → route (wire when the Day 11 port exists; today a `ListTile` in finance suffices).
  6. `apps/mobile/test/bank_accounts_view_test.dart`:
     - `testWidgets('bank accounts render masked with chips', ...)` — fake 2 accounts (one verified primary) → expect masked number, `प्राथमिक`, `सत्यापित ✓`.
     - `testWidgets('verify tap calls api and flips chip', ...)` — tap `सत्यापित करें` → fake recorded `verifyAccount(id)`; chip becomes `सत्यापित ✓` after refetch.
     - `testWidgets('invalid ifsc shows inline error', ...)` — type `SBIN1234` → expect `IFSC अमान्य`; fake api NOT called.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/bank_accounts_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: add account → verify chip turns green → claim flow (Day 11) shows its last-4.

### Task B6 — Settlement sections on earner dashboards (T5/E6/B6)

- **Goal:** Transporter, equipment-owner and broker homes each show a settlements summary card plus a full list screen. Spec: docs/overview/03 Part D items T5/E6/B6. API dependency: Day 9 Task A7.
- **Depends on:** Day 7/8 persona home ports (`transporter_home_view.dart`, `equipment_home_view.dart`, `broker_home_view.dart` — use the Day 7/8 file names); Day 9 Task A7.
- **Files to create/modify:**
  - `apps/mobile/lib/components/settlements_section.dart` (new — compact card)
  - `apps/mobile/lib/views/settlements_view.dart` (new screen)
  - `apps/mobile/lib/api/settlements_api.dart` (new)
  - `apps/mobile/lib/models/settlement.dart` (new)
  - the three persona home views (modify — embed `SettlementsSection`)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `settlements` for transport, equipmentRental, broker)
  - `apps/mobile/test/settlements_view_test.dart` (new)
- **Subtasks:**
  1. `settlements_api.dart`: `listMySettlements()` — picks `/v1/transport/settlements`, `/v1/equipment/settlements`, or `/v1/broker/settlements` from `AppState.currentUser.activeProfile`; throws `StateError` for other personas (callers render the section only for the 3).
  2. `settlement.dart`: `Settlement.fromJson` for the A7 fields (periodStart/End, grossRupees, commissionRupees, netRupees, status).
  3. `settlements_section.dart`: compact card — current-period `शुद्ध ₹{netRupees}` + status chip + text-button `सभी देखें` → route `settlements`.
  4. `settlements_view.dart`: app bar `निपटान`; rows: period `{periodStart} – {periodEnd}`, `सकल ₹{gross}`, `कमीशन ₹{commission}`, bold `शुद्ध ₹{net}`; status chips — pending amber `लंबित`, approved blue `स्वीकृत`, paid green `भुगतान हुआ`; empty state `अभी कोई निपटान नहीं`; pull-to-refresh refetches.
  5. `apps/mobile/test/settlements_view_test.dart`:
     - `testWidgets('settlement row renders amounts', ...)` — fake gross 2000 / commission 200 / net 1800 → expect `₹2,000`-style formatting and `शुद्ध`.
     - `testWidgets('status chip pending renders', ...)` — expect `लंबित`.
     - `testWidgets('empty state renders', ...)` — expect `अभी कोई निपटान नहीं`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/settlements_view_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: after the Task A7 job runs, the transporter home card shows the current settlement.

### Task B7 — Land marketplace: listings, lease requests, agreement PDF (L2/L3/L4)

- **Goal:** Landlord manages land listings + a lease-request inbox; farmers browse "land for rent" inside the Land & Legal tab and request a lease; lease detail gets an agreement-PDF download. Spec: docs/overview/03 Part D items L2–L4. API dependency: Day 9 Task A8.
- **Depends on:** Day 9 Task B4 (landlord screens), Day 10 Task B2 (`land_legal_view.dart` — built tomorrow; land the tab addition there or hold this subtask until then, but keep the API/models today); Day 9 Task A8.
- **Files to create/modify:**
  - `apps/mobile/lib/views/landlord/land_listings_view.dart` (new screen)
  - `apps/mobile/lib/views/landlord/lease_requests_view.dart` (new screen)
  - `apps/mobile/lib/views/land_legal_view.dart` (modify — new tab `किराए की ज़मीन`; coordinate with Day 10 Task B2)
  - `apps/mobile/lib/views/landlord/lease_manage_view.dart` (modify — agreement button)
  - `apps/mobile/lib/api/land_market_api.dart` (new)
  - `apps/mobile/lib/models/land_market_models.dart` (new — `LandListing`, `LeaseRequest`)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — routes `landListings`, `leaseRequests` for farmLandlord)
  - `apps/mobile/lib/views/profile_home/landlord_home_view.dart` (modify — quick action `ज़मीन लिस्टिंग` → `landListings`)
  - `apps/mobile/test/land_market_views_test.dart` (new)
- **Subtasks:**
  1. `land_market_api.dart`: `listListings({near, acres})`, `myListings()`, `createListing(...)`, `updateListing(id, ...)`, `deleteListing(id)`, `requestLease(listingId, durationMonths, message)`, `listLeaseRequests({status})`, `acceptRequest(id)`, `rejectRequest(id, reason)`, `getAgreementUrl(leaseId)` — exact A8 contracts.
  2. Farmer browse (in `land_legal_view.dart`, tab `किराए की ज़मीन`, farmer + farmLandlord): listing cards (village, `areaAcres` acres, `₹{expectedRentRupees}/माह`, soil/water chips, landlordName); filter row — min-acres field + `नज़दीक` toggle (profile farm location → `near=`); card CTA `पट्टा अनुरोध करें` → dialog (duration-months stepper + message) → `requestLease` → 201 SnackBar `अनुरोध भेजा गया`; on `DUPLICATE_LEASE_REQUEST` → `अनुरोध पहले से भेजा गया`; on `LISTING_NOT_OPEN` → `यह लिस्टिंग अब उपलब्ध नहीं है`.
  3. `land_listings_view.dart` (landlord): app bar `मेरी ज़मीन लिस्टिंग`; own listings with status chips `खुला` / `पट्टे पर` / `बंद`; FAB `+ लिस्टिंग` form (village, district, area, expected rent, optional plot dropdown from Day 9 Task B4 `listPlots`); tap a card → `lease_requests_view` for that listing.
  4. `lease_requests_view.dart`: app bar `पट्टा अनुरोध`; pending cards (farmerName, village, durationMonths, message, listing village) with `स्वीकारें` (green) / `अस्वीकारें` (red); accept → confirm dialog `पट्टा बनाया जाएगा` → `acceptRequest` → SnackBar `पट्टा सक्रिय` → navigate to `landlordLeases`; reject → reason dialog → `rejectRequest`; on `REQUEST_ALREADY_RESOLVED` → `अनुरोध पहले ही निपटाया गया`.
  5. `lease_manage_view.dart`: lease-card overflow menu adds `अनुबंध PDF` → `getAgreementUrl(lease.id)` → `url_launcher` `launchUrl` external.
  6. `apps/mobile/test/land_market_views_test.dart`:
     - `testWidgets('browse tab renders listing cards', ...)` — fake 2 listings → expect villages and `₹` rent text.
     - `testWidgets('request lease posts and shows snackbar', ...)` — submit dialog → fake recorded `requestLease`; expect `अनुरोध भेजा गया`.
     - `testWidgets('inbox accept calls api', ...)` — tap `स्वीकारें` + confirm → fake recorded `acceptRequest(id)`.
     - `testWidgets('lease overflow shows agreement action', ...)` — expect `अनुबंध PDF` in the menu.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/land_market_views_test.dart`
- **Expected output:** `No issues found!`; 4 tests pass; manual e2e: landlord lists a plot → farmer requests → landlord accepts → lease appears → agreement PDF opens.

### Done-when additions (additional tasks)

- [ ] `cd backend && .venv/bin/pytest tests/test_bank_accounts.py tests/test_settlements.py tests/test_land_market.py -v` → 18 passed; `tests/test_finance.py` now 7 passed; full suite green.
- [ ] Full account number never appears in any response or log (masked-field test + `grep -rn "accountNumber" backend/app/routers/bank_accounts.py` shows masking only).
- [ ] Settlement job: delivered bookings aggregate to one pending settlement per earner; rerun idempotent; missing/wrong cron secret → 401 `CRON_UNAUTHORIZED`.
- [ ] Lease-request accept creates a lease, flips the listing to `leased`, and auto-rejects competing pending requests.
- [ ] Agreement PDF is a valid PDF containing both parties' names (one manual open).
- [ ] `endpoints.md` section 21 extended with the bank-account, settlement, listing, lease-request, and agreement routes.
- [ ] `flutter analyze` 0 issues; 10 new widget tests pass (bank accounts 3, settlements 3, land market 4).
- [ ] Manual: bank account add → verify chip green → claim shows its last-4; transporter settlement visible after the job run; land listing → request → accept → PDF opens.
