# phase-00 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

> Ordering note (from instructions.md): workstreams run in numbered order.
> WS-06's test repair is cross-cutting — when a checkpoint's scoped pytest run
> fails ONLY on tests unrelated to the files your workstream touched, record
> the failing test ids in your report and proceed; WS-06 repairs them. A
> failure in a test file your workstream touched must be fixed before the
> checkpoint is marked.

## WS-01 — Kill demo backdoors & secrets hygiene  (see instructions.md §WS-01)

### Task 1.1 — Add prod secret validator to config
- DO: Edit `backend/app/core/config.py`: (1) add `from pydantic import AliasChoices, Field, model_validator` to imports; (2) replace the line `env: str = "dev"` with `env: str = Field(default="dev", validation_alias=AliasChoices("APP_ENV", "ENV"))`; (3) add this method inside class `Settings`:
  ```python
  @model_validator(mode="after")
  def _require_real_secrets_outside_dev(self):
      if self.env in ("staging", "prod"):
          missing = []
          if self.jwt_secret in ("", "dev-secret-change-me"):
              missing.append("jwt_secret")
          if not self.razorpay_key_id:
              missing.append("razorpay_key_id")
          if not self.razorpay_key_secret:
              missing.append("razorpay_key_secret")
          if missing:
              raise ValueError(
                  f"refusing to start with env={self.env}: unsafe/missing {', '.join(missing)}"
              )
      return self
  ```
- RUN: `.venv/bin/python -c "from app.core.config import settings; print(settings.env)"` (cwd: `backend/`)
- EXPECT: exit 0, output is `dev`.
- IF FAIL: fix the import line / indentation of the validator, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.2 — Verify prod boot fails without secrets
- DO: No file change — run the check (this is the instructions.md verification command).
- RUN: `APP_ENV=prod JWT_SECRET= .venv/bin/python -c "from app.main import app"` (cwd: `backend/`)
- EXPECT: non-zero exit code; output contains `jwt_secret`.
- IF FAIL: the validator from task 1.1 is not executing — reopen `config.py`, confirm the `model_validator` is inside class `Settings`, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.3 — Verify prod boots with real secrets
- DO: No file change — run the check.
- RUN: `APP_ENV=prod JWT_SECRET=prod-secret-0123456789abcdef RAZORPAY_KEY_ID=rzp_test_placeholder RAZORPAY_KEY_SECRET=placeholder_secret .venv/bin/python -c "from app.main import app; print('boot ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output contains `boot ok`.
- IF FAIL: read the validation error, correct the env var names in the command to match `AliasChoices("APP_ENV", "ENV")`, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.4 — Document env selector in backend env example
- DO: Edit `backend/.env.example`: directly above the line `ENV=dev` insert these two comment lines:
  ```
  # Canonical environment selector: ENV (APP_ENV is also accepted). Values: dev | staging | prod.
  # staging/prod refuse to boot without a real JWT_SECRET and Razorpay keys.
  ```
- RUN: `grep -n "APP_ENV is also accepted" backend/.env.example`
- EXPECT: exit 0, one matching line.
- IF FAIL: re-open the file and add the comment exactly — else STOP (playbook §5) with full output.
- [x]

### Task 1.5 — Gate dev/demo id tokens behind dev env
- DO: Edit `backend/app/routers/auth.py`: (1) add `from app.core.config import settings` to the imports; (2) in `_verify_firebase_token` (~L39) change the condition to `if settings.env == "dev" and (id_token.startswith("dev-") or id_token.startswith("demo-")):`. In non-dev these tokens now fall through to `firebase_auth.verify_id_token` and fail with the standard 401 `INVALID_FIREBASE_TOKEN` envelope.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all tests in the file pass.
- IF FAIL: read the first failure; if caused by this edit, fix the gate; if pre-existing and unrelated, record it and re-run to confirm — else STOP (playbook §5) with full output.
- [x]

### Task 1.6 — Gate login MPIN 1234 bypass
- DO: Edit `backend/app/routers/auth.py` in `login_with_phone_mpin` (~L75): change the bypass condition so the `1234` shortcut only applies in dev — the inner condition becomes `settings.env == "dev" and body.mpin == "1234" and (u["id"].startswith("dev-") or u["id"].startswith("omni-") or u.get("isDemo", False))`.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the condition parenthesisation, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.7 — Gate mpin/verify MPIN 1234 bypass
- DO: Edit `backend/app/routers/auth.py` in `mpin_verify` (~L295): change the fallback to `if settings.env == "dev" and body.mpin == "1234" and (uid.startswith("dev-") or uid.startswith("omni-") or user.get("isDemo", False)):`.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the condition, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.8 — Disable quick-login outside dev
- DO: Edit `backend/app/routers/auth.py`: make the FIRST statement of `quick_login` (~L317, before `PERSONA_DEFAULTS`):
  ```python
  if settings.env != "dev":
      _error(403, "DISABLED_IN_PROD", "quick-login is only available in dev")
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: confirm the gate is the first statement of the function, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.9 — Require explicit MPIN in quick-login
- DO: Edit `backend/app/routers/auth.py` in `quick_login`: (1) immediately after the dev gate from task 1.8 add:
  ```python
  if not body.mpin:
      _error(422, "MPIN_REQUIRED", "an explicit MPIN is required")
  ```
  (2) replace every occurrence of `hash_mpin(body.mpin or "1234")` with `hash_mpin(body.mpin)` (there are five: in the persona-defaults branch, the existing-user branch, the omni fallback branch, the found-by-phone branch, and the new-user-by-phone branch). No `or "1234"` fallback may remain (playbook §3 rule 3).
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py && grep -n 'or "1234"' app/routers/auth.py; test $? -eq 1` (cwd: `backend/`)
- EXPECT: tests pass AND the grep finds nothing (exit 1 from grep).
- IF FAIL: remove the missed `or "1234"` occurrence, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.10 — Reject trivial MPINs outside dev
- DO: Edit `backend/app/core/security.py`: (1) add `from app.core.config import settings` to imports; (2) at the end of `validate_mpin_format` append:
  ```python
  if settings.env != "dev" and (
      len(set(mpin)) == 1 or mpin in {"1234", "4321", "0123", "3210", "1212", "1122"}
  ):
      raise HTTPException(
          status_code=422,
          detail={
              "code": "WEAK_MPIN",
              "message": "MPIN is too predictable",
              "fieldErrors": {"mpin": "choose a less predictable 4-digit MPIN"},
          },
      )
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (tests run with `env=dev`, so the dev path is unaffected).
- IF FAIL: check the function still accepts valid non-trivial MPINs, fix, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.11 — Delete dev Razorpay signature shortcut
- DO: Edit `backend/app/services/payments.py` in `verify_razorpay_signature` (L21–22): replace `return signature == "dev"` with `return False` — an empty `razorpay_key_secret` must NEVER accept any signature.
- RUN: `.venv/bin/python -c "import hmac, hashlib; from app.core.config import settings; from app.services.payments import verify_razorpay_signature as v; assert v('o1','p1','dev') is False; settings.razorpay_key_secret='k'; sig=hmac.new(b'k', b'o1|p1', hashlib.sha256).hexdigest(); assert v('o1','p1',sig) is True; assert v('o1','p1','bad') is False; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: re-read the function and apply the edit exactly — else STOP (playbook §5) with full output.
- [x]

### Task 1.12 — Remove rzp_test_dev key fallback
- DO: Edit `backend/app/routers/orders.py` in `razorpay_order` (~L184): (1) as the first statement after `order = await _own_order(...)` add:
  ```python
  if not settings.razorpay_key_id:
      _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
  ```
  (2) change `"keyId": settings.razorpay_key_id or "rzp_test_dev"` to `"keyId": settings.razorpay_key_id`.
- RUN: `.venv/bin/python -m pytest -q tests/test_orders.py tests/test_order_lifecycle.py tests/test_order_cancel.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: if tests exercise the dev no-key path, that path is now a 503 envelope — record pre-existing vs new failures (see ordering note) and fix only failures caused by this edit — else STOP (playbook §5) with full output.
- [x]

### Task 1.13 — Lock CORS to configured origins
- DO: (1) Edit `backend/app/core/config.py`: add field `web_origins: list[str] = ["http://localhost:5173"]` to `Settings`. (2) Edit `backend/app/main.py`: replace `allow_origins=["*"]` with `allow_origins=settings.web_origins`. (3) Edit `backend/.env.example`: append `WEB_ORIGINS=["http://localhost:5173"]` preceded by comment `# JSON array of allowed web origins; staging/prod list the real domains.`.
- RUN: `.venv/bin/python -m pytest -q tests/test_infra.py && .venv/bin/python -c "from app.core.config import settings; print(settings.web_origins)"` (cwd: `backend/`)
- EXPECT: tests pass; the python check prints `['http://localhost:5173']`.
- IF FAIL: pydantic-settings parses list env vars as JSON — confirm the `.env.example` value is a JSON array, fix, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.14 — Move Firebase web config to env vars
- DO: Edit `website/src/lib/firebase.ts`: replace the hardcoded `firebaseConfig` object (L16–23) with:
  ```ts
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  };
  ```
  The exposed hardcoded key is rotated in task 1.20. Do not leave the old values anywhere in the file.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the `import.meta.env` typings, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.15 — Extend website env example with Firebase keys
- DO: Edit `website/.env.example`: append these lines:
  ```
  # Firebase web SDK config (values from Firebase console > project settings > web app).
  VITE_FIREBASE_API_KEY=
  VITE_FIREBASE_APP_ID=
  VITE_FIREBASE_MESSAGING_SENDER_ID=
  VITE_FIREBASE_PROJECT_ID=
  VITE_FIREBASE_AUTH_DOMAIN=
  VITE_FIREBASE_STORAGE_BUCKET=
  # reCAPTCHA v3 site key for Firebase App Check.
  VITE_FIREBASE_APPCHECK_SITE_KEY=
  ```
- RUN: `grep -c "VITE_FIREBASE_" website/.env.example`
- EXPECT: exit 0, output `7`.
- IF FAIL: add the missing key lines, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.16 — Initialize Firebase App Check on website
- DO: Edit `website/src/lib/firebase.ts`: (1) add `import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';` to imports; (2) immediately after `export const firebaseAuth: Auth = getAuth(firebaseApp);` add:
  ```ts
  const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;

  export const firebaseAppCheck = appCheckSiteKey
    ? initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    : null;

  export async function getAppCheckToken(): Promise<string | null> {
    if (!firebaseAppCheck) return null;
    try {
      return (await getToken(firebaseAppCheck, false)).token;
    } catch {
      return null;
    }
  }
  ```
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: confirm the installed `firebase` package exports `firebase/app-check` (it does in v10), fix the import, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.17 — Send App Check header from API client
- DO: Edit `website/src/lib/api/client.ts`: (1) add `import { getAppCheckToken } from '../firebase';` to imports; (2) change the request interceptor to async and attach the header — the interceptor becomes:
  ```ts
  api.interceptors.request.use(async (config) => {
    config.headers = config.headers ?? {};
    const lang = useOnboardingStore.getState().language;
    config.headers['Accept-Language'] = lang || 'en';
    if (!isPublicPath(config.url)) {
      const token = useSessionStore.getState().accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) config.headers['X-Firebase-AppCheck'] = appCheckToken;
    if (config.method && config.method !== 'get') {
      config.headers['Idempotency-Key'] = crypto.randomUUID();
    }
    return config;
  });
  ```
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the interceptor signature typing, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.18 — Verify App Check tokens backend-side
- DO: (1) Edit `backend/app/core/firebase.py`: append:
  ```python
  def verify_app_check_token(token: str) -> bool:
      if not firebase_admin._apps:
          logger.warning("firebase not initialised; cannot verify App Check token")
          return False
      try:
          from firebase_admin import app_check
          app_check.verify_token(token)
          return True
      except Exception:
          return False
  ```
  (2) Edit `backend/app/main.py`: add `from app.core.firebase import init_firebase, verify_app_check_token` (extend the existing import) and, immediately after `app = FastAPI(...)`, add:
  ```python
  @app.middleware("http")
  async def app_check_middleware(request: Request, call_next):
      if settings.env != "dev" and request.url.path.startswith("/v1"):
          token = request.headers.get("X-Firebase-AppCheck")
          if token and not verify_app_check_token(token):
              return JSONResponse(
                  status_code=401,
                  content={"error": {"code": "APPCHECK_INVALID", "message": "invalid Firebase App Check token", "fieldErrors": {}}},
              )
      return await call_next(request)
  ```
  (Header absent → allowed in this phase; full enforcement comes with Firebase App Check enforcement in the console — see instructions.md §WS-01 step 5.)
- RUN: `.venv/bin/python -m pytest -q tests/test_infra.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (tests run with `env=dev`, so the middleware is inert).
- IF FAIL: fix imports/middleware placement, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.19 — Add prod-guard regression tests
- DO: Create `backend/tests/test_prod_guards.py` (new) with exactly this content:
  ```python
  import pytest
  from fastapi import HTTPException

  from app.core.security import validate_mpin_format
  from app.services.payments import verify_razorpay_signature


  @pytest.fixture
  def prod_env(monkeypatch):
      monkeypatch.setattr("app.core.config.settings.env", "prod")
      yield
      # monkeypatch restores dev automatically


  async def test_quick_login_forbidden_in_prod(client, prod_env):
      resp = await client.post("/v1/auth/quick-login", json={"persona": "farmer", "mpin": "9876"})
      assert resp.status_code == 403
      assert resp.json()["error"]["code"] == "DISABLED_IN_PROD" if "error" in resp.json() else resp.json()["detail"]["code"] == "DISABLED_IN_PROD"


  async def test_mpin_1234_rejected_in_prod(client, user_store, prod_env):
      from app.core.security import hash_mpin
      user_store["users/dev-x"] = {"id": "dev-x", "phone": "+919000000001", "mpinHash": hash_mpin("5555")}
      resp = await client.post("/v1/auth/login", json={"phone": "+919000000001", "mpin": "1234"})
      assert resp.status_code == 401


  def test_dev_signature_never_accepted(monkeypatch):
      monkeypatch.setattr("app.core.config.settings.razorpay_key_secret", "")
      assert verify_razorpay_signature("o1", "p1", "dev") is False


  def test_trivial_mpin_rejected_in_prod(prod_env):
      with pytest.raises(HTTPException) as exc:
          validate_mpin_format("1234")
      assert exc.value.status_code == 422
      assert exc.value.detail["code"] == "WEAK_MPIN"


  async def test_cors_rejects_unknown_origin(client):
      resp = await client.options(
          "/v1/health",
          headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
      )
      allow = resp.headers.get("access-control-allow-origin")
      assert allow != "*"
      assert allow != "https://evil.example"
  ```
  Note for the executor: `test_quick_login_forbidden_in_prod`'s assertion handles both the pre-WS-06 (`detail`-shaped) and post-WS-06 (`error`-shaped) envelope; once WS-06 task 6.8 lands, simplify it to the `error` shape only.
- RUN: `.venv/bin/python -m pytest -q tests/test_prod_guards.py` (cwd: `backend/`)
- EXPECT: exit 0, `5 passed`.
- IF FAIL: fix the failing assertion against the real response shape (print `resp.json()` once to see it), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.20 — HUMAN CHECK: rotate exposed secrets
- DO: HUMAN CHECK — the human operator must: (1) in the Firebase console, rotate/restrict the web API key that was hardcoded in `website/src/lib/firebase.ts` (`AIzaSyDj2...No_k`); (2) in the Razorpay dashboard, roll any keys that ever shipped in code or docs; (3) create `.run-logs/phase-00-secrets-rotation.md` (new) recording one line per rotated secret: `<date> <which secret> rotated in <console>`. Executor: create the file with a header line `# phase-00 secrets rotation log` if the human has not; the human fills in the entries.
- RUN: `test -f .run-logs/phase-00-secrets-rotation.md`
- EXPECT: file exists; the human confirms rotation entries are recorded in it.
- IF FAIL: create the file with the header line and ask the human to record rotations before continuing — else STOP (playbook §5) with full output.
- [ ]

### Task 1.21 — Sweep for ungated demo paths
- DO: Run the sweep grep. For every hit, read the surrounding function and confirm it executes only inside a `settings.env == "dev"` branch (the four gated spots from tasks 1.5–1.8) — otherwise delete or gate that code path now. Only `backend/app/routers/auth.py` may retain `dev-user`/`demo-`/`"1234"` strings, and only inside the gated blocks.
- RUN: `grep -rn 'sess_demo\|dev-user\|demo-\|"1234"' backend/app website/src`
- EXPECT: exit 0 or 1; every printed hit is inside `backend/app/routers/auth.py` within `_verify_firebase_token`, `login_with_phone_mpin`, `mpin_verify`, or `quick_login`, and each is provably behind `settings.env == "dev"` (or is the `WEAK_MPIN` denylist in `backend/app/core/security.py`). Zero hits in `website/src`.
- IF FAIL: gate or delete the offending code, re-run the grep — else STOP (playbook §5) with full output.
- [x]

### Task 1.22 — HUMAN CHECK: dev login flows still work
- DO: HUMAN CHECK — (1) terminal 1: `cd backend && .venv/bin/uvicorn app.main:app --port 8000` (default `ENV=dev`); (2) terminal 2: `cd website && pnpm dev`; (3) in the browser open the dev URL, use quick-login as persona `farmer` WITH an explicit MPIN (must succeed), then log out and log back in with phone + that MPIN (must succeed); (4) retry quick-login WITHOUT an MPIN (must fail with `MPIN_REQUIRED`).
- RUN: `curl -s -X POST http://localhost:8000/v1/auth/quick-login -H 'Content-Type: application/json' -d '{"persona":"farmer"}' | grep -o MPIN_REQUIRED` (requires the dev server from step 1 running)
- EXPECT: output `MPIN_REQUIRED`; the human confirms the two successful dev logins.
- IF FAIL: if the server is not running, start it with the command in step 1 and re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.23 — WS-01 checkpoint: verify and commit
- DO: Run the full WS-01 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_auth.py tests/test_infra.py tests/test_prod_guards.py && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-00 WS-01: kill demo backdoors & secrets hygiene"`
- EXPECT: backend tests pass; `tsc` clean; `pnpm build` succeeds; git commit created (if git identity is missing, note it and continue per playbook §6).
- IF FAIL: fix the failing step (never weaken a test — playbook §3 rule 2), re-run the whole line — else STOP (playbook §5) with full output.
- [x]

## WS-02 — Auth & admin-auth unification  (see instructions.md §WS-02)

### Task 2.1 — Teach conftest an admin Firebase token
- DO: Edit `backend/tests/conftest.py`: replace the existing `fake_verify_id_token` definition with:
  ```python
  def fake_verify_id_token(id_token, check_revoked=False):
      if id_token == "admin-token":
          return {"uid": "uid-admin-test", "phone_number": "+919800000000", "admin": True, "role": "superadmin"}
      if id_token == "plain-token":
          return {"uid": "uid-plain", "phone_number": "+919800000001"}
      return {"uid": "uid-1", "phone_number": "+919812345678"}
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: exit 0 (baseline unchanged — `admin.py` not yet modified).
- IF FAIL: this is a pre-existing failure — record it and continue (see ordering note); if the file has a syntax/import error from your edit, fix it — else STOP (playbook §5) with full output.
- [x]

### Task 2.2 — Route admin.py through core deps admin_user
- DO: Edit `backend/app/routers/admin.py`: (1) delete the `_require_admin` function (~L24–32) and the `_admin_user` function (~L35–40), including the hardcoded UID fallback (`admin-root`, `uid-admin`, `admin-demo`); (2) replace `from app.core.deps import current_user_id` with `from app.core.deps import admin_user`; (3) replace every `Depends(_admin_user)` with `Depends(admin_user)`; (4) in every handler, replace `user["id"]` with `user["uid"]` (Firebase claims carry `uid`, not `id`); (5) remove now-unused imports (`current_user_id`, `get_user` if unused elsewhere in the file — check before removing).
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: command completes; failures caused by the auth-mechanism switch are expected here and fixed in task 2.5 — no 500s from `NameError`/`ImportError` (i.e. no test may error with a missing `_admin_user` reference).
- IF FAIL: `grep -n "_admin_user\|_require_admin" app/routers/admin.py` must return nothing — remove the missed reference, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.3 — Add admin_action dependency with audit headers
- DO: Edit `backend/app/core/deps.py`: (1) add imports `from datetime import datetime, timezone`, `from fastapi import Request`, `from app.core.db import set_doc`; (2) append:
  ```python
  def admin_action(action: str):
      """Mutating-admin dependency: requires X-Audit-Reason + X-Admin-Role headers,
      validates the role against the caller's claims, and writes an audit_logs doc.
      Rule 8: no admin action without an audit_logs entry + reason."""
      async def dep(
          request: Request,
          claims: dict = Depends(admin_user),
          x_audit_reason: str | None = Header(None),
          x_admin_role: str | None = Header(None),
      ) -> dict:
          if not x_audit_reason or not x_audit_reason.strip():
              _error(400, "AUDIT_REASON_REQUIRED", "X-Audit-Reason header is required")
          claim_role = claims.get("role", "superadmin")
          if x_admin_role != claim_role:
              _error(403, "ADMIN_ROLE_MISMATCH", "X-Admin-Role does not match the caller's claims")
          target_id = next(iter(request.path_params.values()), "")
          await set_doc(
              "audit_logs",
              f"aud_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}_{claims['uid']}",
              {
                  "adminId": claims["uid"],
                  "role": claim_role,
                  "action": action,
                  "targetId": target_id,
                  "reason": x_audit_reason,
                  "at": datetime.now(timezone.utc).isoformat(),
              },
          )
          return claims
      return dep
  ```
- RUN: `.venv/bin/python -c "from app.core.deps import admin_action; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports (notably `Depends`/`Header` already imported at top of `deps.py`), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.4 — Wire admin_action into admin mutations
- DO: Edit `backend/app/routers/admin.py`: (1) add `from app.core.deps import admin_user, admin_action` (replace the task-2.2 import); (2) on EVERY mutating endpoint (`@router.post` / `@router.put` / `@router.delete` in this file — at minimum `update_user_status`, `review_kyc_document`, the claim-adjudication endpoint, and the expert-ticket resolve endpoint) add a dependency parameter `_audit: dict = Depends(admin_action("<ACTION_NAME>"))` where `<ACTION_NAME>` is the existing audit action string for that endpoint (e.g. `"UPDATE_USER_STATUS"`, `"REVIEW_KYC_DOC"`). Read-only `@router.get` endpoints keep `Depends(admin_user)` only.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: command completes; admin mutations without the new headers now 400 `AUDIT_REASON_REQUIRED` — failing assertions about that are fixed in task 2.5.
- IF FAIL: fix any `NameError`/signature error, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.5 — Update admin tests for new auth path
- DO: Edit `backend/tests/test_admin.py`: make every admin request use a Firebase admin identity — header `Authorization: Bearer admin-token` (the conftest token from task 2.1) — and make every admin MUTATION also send `X-Admin-Role: superadmin` and `X-Audit-Reason: test reason`. Where a test asserts 403 for a non-admin, use `Bearer plain-token`. Where a test asserts the old hardcoded-UID behavior, update it to assert 403 for `plain-token` instead (this is adapting tests to the WS-02 spec, not weakening them — the spec changed per instructions.md §WS-02 steps 1–2). Never delete an assertion without replacing it with the equivalent new-mechanism assertion.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the remaining header/identity mismatch in the failing test, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.6 — Add jti refresh-token helpers to tokens service
- DO: Edit `backend/app/services/tokens.py`: (1) add imports `import logging`, `import uuid`, `from app.core.cache import REDIS_ERRORS, get_redis`; (2) add `"jti": uuid.uuid4().hex` to the refresh payload in `create_refresh_token`; (3) append:
  ```python
  log = logging.getLogger(__name__)


  def decode_refresh_token(token: str) -> tuple[str, str]:
      try:
          payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
      except JWTError:
          raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "invalid or expired token", "fieldErrors": {}})
      if payload.get("type") != "refresh" or not payload.get("jti"):
          raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "invalid or expired token", "fieldErrors": {}})
      return payload["sub"], payload["jti"]


  async def store_refresh_jti(jti: str, user_id: str):
      ttl = settings.jwt_refresh_ttl_days * 86400
      try:
          r = await get_redis()
          await r.set(f"auth:refresh:{jti}", user_id, ex=ttl)
          await r.sadd(f"auth:refresh_family:{user_id}", jti)
          await r.expire(f"auth:refresh_family:{user_id}", ttl)
      except REDIS_ERRORS as exc:
          log.warning("redis unavailable (store refresh jti): %s", exc)


  async def is_refresh_live(jti: str) -> bool:
      try:
          return await (await get_redis()).get(f"auth:refresh:{jti}") is not None
      except REDIS_ERRORS as exc:
          log.warning("redis unavailable (check refresh jti): %s", exc)
          return True  # fail-open in dev; prod requires Redis


  async def revoke_refresh_jti(jti: str):
      try:
          await (await get_redis()).delete(f"auth:refresh:{jti}", f"auth:session:{jti}")
      except REDIS_ERRORS as exc:
          log.warning("redis unavailable (revoke refresh jti): %s", exc)


  async def revoke_refresh_family(user_id: str) -> int:
      try:
          r = await get_redis()
          jtis = await r.smembers(f"auth:refresh_family:{user_id}")
          if jtis:
              await r.delete(*[f"auth:refresh:{j}" for j in jtis], *[f"auth:session:{j}" for j in jtis])
          await r.delete(f"auth:refresh_family:{user_id}")
          return len(jtis)
      except REDIS_ERRORS as exc:
          log.warning("redis unavailable (revoke family): %s", exc)
          return 0
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (refresh tokens now carry `jti`; old `decode_token` path unchanged).
- IF FAIL: fix the failing import/signature, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.7 — Store refresh jti and session metadata on issue
- DO: Edit `backend/app/routers/auth.py`: (1) extend the tokens import to `from app.services.tokens import create_access_token, create_refresh_token, decode_refresh_token, decode_token, store_refresh_jti`; (2) add this helper near `_public_user`:
  ```python
  async def _issue_session(uid: str, user_agent: str | None) -> dict:
      pair = {"accessToken": create_access_token(uid), "refreshToken": create_refresh_token(uid)}
      _, jti = decode_refresh_token(pair["refreshToken"])
      await store_refresh_jti(jti, uid)
      try:
          from app.core.cache import get_redis
          from app.core.config import settings
          now = datetime.now(timezone.utc).isoformat()
          await (await get_redis()).hset(
              f"auth:session:{jti}",
              mapping={"userId": uid, "device": user_agent or "unknown", "createdAt": now, "lastUsedAt": now},
          )
          await (await get_redis()).expire(f"auth:session:{jti}", settings.jwt_refresh_ttl_days * 86400)
      except Exception:
          pass  # Redis optional in dev; sessions list degrades to empty
      return pair
  ```
  (3) in `login_with_phone_mpin`, `firebase_verify`, `register`, and `quick_login` (both return sites): add a `user_agent: str | None = Header(None)` parameter and build the token pair via `pair = await _issue_session(uid, user_agent)` then `accessToken=pair["accessToken"], refreshToken=pair["refreshToken"]` in each `AuthResponse`.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the missed call site (`grep -n "create_refresh_token" app/routers/auth.py` — every one must flow through `_issue_session`), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.8 — Rotate refresh tokens with replay protection
- DO: Edit `backend/app/routers/auth.py`: (1) extend the tokens import with `is_refresh_live, revoke_refresh_family, revoke_refresh_jti`; (2) rewrite the `refresh` handler (~L249) as:
  ```python
  @router.post("/refresh", response_model=TokenPair)
  async def refresh(body: RefreshRequest):
      user_id, jti = decode_refresh_token(body.refreshToken)
      if not await is_refresh_live(jti):
          await revoke_refresh_family(user_id)
          _error(401, "REFRESH_REPLAYED", "refresh token reuse detected — all sessions revoked")
      await revoke_refresh_jti(jti)
      new_refresh = create_refresh_token(user_id)
      _, new_jti = decode_refresh_token(new_refresh)
      await store_refresh_jti(new_jti, user_id)
      return TokenPair(accessToken=create_access_token(user_id), refreshToken=new_refresh)
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: if a test replays a refresh token and now gets 401, that assertion is updated in task 2.12 — record it here and continue only if every other failure is understood — else STOP (playbook §5) with full output.
- [x]

### Task 2.9 — Add GET /auth/sessions endpoint
- DO: Edit `backend/app/routers/auth.py`: append:
  ```python
  @router.get("/sessions")
  async def list_sessions(uid: str = Depends(current_user_id)):
      from app.core.cache import get_redis
      try:
          r = await get_redis()
          jtis = await r.smembers(f"auth:refresh_family:{uid}")
          sessions = []
          for jti in sorted(jtis):
              meta = await r.hgetall(f"auth:session:{jti}")
              if meta:
                  sessions.append({"id": jti, **meta})
          return {"sessions": sessions}
      except Exception:
          return {"sessions": []}
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the endpoint (imports inside the function are intentional), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.10 — Add DELETE /auth/sessions/{jti} endpoint
- DO: Edit `backend/app/routers/auth.py`: append:
  ```python
  @router.delete("/sessions/{jti}")
  async def revoke_session(jti: str, uid: str = Depends(current_user_id)):
      from app.core.cache import get_redis
      try:
          r = await get_redis()
          if not await r.sismember(f"auth:refresh_family:{uid}", jti):
              _error(404, "SESSION_NOT_FOUND", "no such session for this user")
      except HTTPException:
          raise
      except Exception:
          _error(404, "SESSION_NOT_FOUND", "no such session for this user")
      await revoke_refresh_jti(jti)
      return {"ok": True}
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the membership check, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.11 — Add logout endpoint revoking current jti
- DO: Edit `backend/app/routers/auth.py`: append:
  ```python
  @router.post("/logout")
  async def logout(body: RefreshRequest):
      user_id, jti = decode_refresh_token(body.refreshToken)
      await revoke_refresh_jti(jti)
      return {"ok": True}
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the handler, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.12 — Add rotation, replay, and session tests
- DO: Edit `backend/tests/test_auth.py`: append new tests (use the existing `client`, `user_store`, `fake_redis` fixtures; each new test must first `monkeypatch.setattr("app.services.tokens.get_redis", lambda: _fake())` where `_fake` is an async function returning the `fake_redis` fixture — request `fake_redis` and `monkeypatch` as test parameters):
  1. `test_refresh_rotation_invalidates_old` — login (seed a user with a known MPIN via `user_store`), call `/v1/auth/refresh` with the refresh token → 200 with a NEW refresh token; calling `/v1/auth/refresh` again with the OLD token → 401.
  2. `test_refresh_replay_revokes_family` — login, refresh once (token B), replay token A → 401 `REFRESH_REPLAYED`; then token B must ALSO be rejected (401).
  3. `test_sessions_list_and_revoke` — login twice (two refresh tokens), `GET /v1/auth/sessions` with the access token → 2 sessions; `DELETE /v1/auth/sessions/{first jti}` → `{"ok": true}`; using the first refresh token afterwards → 401; the second refresh token still works.
  (Get each token's `jti` in the test via `app.services.tokens.decode_refresh_token`.)
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py -k "rotation or replay or sessions"` (cwd: `backend/`)
- EXPECT: exit 0, the 3 new tests pass.
- IF FAIL: print the 401/500 body in the failing test and align it with the implemented behavior (the implementation is the truth per instructions.md §WS-02 steps 3–4), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.13 — Add mpinReentryRequired flag to session store
- DO: Edit `website/src/stores/session.ts`: add state field `mpinReentryRequired: boolean` (initial `false`), an action `setMpinReentryRequired(v: boolean)`, and make the existing `clear()` also reset `mpinReentryRequired` to `false`. Persist it alongside the existing persisted fields if the store uses `persist`.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: match the store's existing zustand patterns exactly, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.14 — Route 401 refresh failure to MPIN re-entry
- DO: Edit `website/src/lib/api/client.ts` in `refreshSession`'s `catch` block: replace the hard `useSessionStore.getState().clear(); window.location.assign('/auth')` behavior with:
  ```ts
  useSessionStore.getState().setMpinReentryRequired(true);
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth?reentry=mpin');
  }
  ```
  Keep the `return null` and the `finally` block. Do NOT clear tokens/user here — the MPIN re-entry sheet (task 2.15) refreshes silently on success; a full logout only happens if the user cancels or MPIN verify fails (missing.md F2).
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: fix the store action name to match task 2.13, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.15 — Build MPIN re-entry sheet with i18n
- DO: (1) Create `website/src/views/auth/MpinReentrySheet.tsx` (new): a sheet/modal styled like the existing `ForgotMpinSheet.tsx` (read it first and mirror its structure) with a 4-digit MPIN input and submit; on submit it calls `POST /v1/auth/mpin/verify` then `POST /v1/auth/refresh` (via the existing wrappers in `website/src/lib/api/auth.ts` — read it and reuse; add a `verifyMpin` wrapper there if none exists), on success calls `setMpinReentryRequired(false)` and navigates back to `window.history.back()`-equivalent route state, on failure shows the error text from the envelope (NO `alert()` — playbook §3 rule 3). All user-facing strings via `t()`. (2) Edit `website/src/lib/i18n/locales/en.ts` AND `website/src/lib/i18n/locales/hi.ts`: add matching keys `auth.mpinReentry.title` ("Session expired — re-enter MPIN" / "सत्र समाप्त — MPIN दोबारा दर्ज करें"), `auth.mpinReentry.subtitle`, `auth.mpinReentry.submit`, `auth.mpinReentry.failed`. (3) Edit `website/src/views/auth/AuthView.tsx`: when the URL has `?reentry=mpin` or `mpinReentryRequired` is true, render `MpinReentrySheet` instead of the login choices.
- RUN: `pnpm exec tsc --noEmit && node -e "const en=require('fs').readFileSync('src/lib/i18n/locales/en.ts','utf8');const hi=require('fs').readFileSync('src/lib/i18n/locales/hi.ts','utf8');for(const k of ['mpinReentry']){if(!en.includes(k)||!hi.includes(k))process.exit(1)}console.log('parity ok')"` (cwd: `website/`)
- EXPECT: `tsc` exit 0 and output `parity ok` (keys present in BOTH locale files — playbook §3 rule 3).
- IF FAIL: add the missing locale key(s) to whichever file lacks them, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.16 — Create Redis rate-limit core module
- DO: Create `backend/app/core/ratelimit.py` (new) with exactly:
  ```python
  import logging

  from fastapi import HTTPException, Request

  from app.core.cache import REDIS_ERRORS, get_redis

  log = logging.getLogger(__name__)


  async def hit(scope: str, ident: str, limit: int, window_seconds: int):
      """Token-bucket-ish fixed-window counter; key rl:<scope>:<ident>.
      429 with the standard error envelope when over limit. Fails open when
      Redis is unavailable (dev), matching core/cache.py semantics."""
      try:
          r = await get_redis()
          n = await r.incr(f"rl:{scope}:{ident}")
          if n == 1:
              await r.expire(f"rl:{scope}:{ident}", window_seconds)
      except REDIS_ERRORS as exc:
          log.warning("rate limiter unavailable (%s): %s", scope, exc)
          return
      if n > limit:
          raise HTTPException(
              status_code=429,
              detail={"code": "RATE_LIMITED", "message": "too many requests — try again later", "fieldErrors": {}},
          )


  def rate_limit_ip(scope: str, limit: int, window_seconds: int):
      async def dep(request: Request):
          ident = request.client.host if request.client else "unknown"
          await hit(scope, ident, limit, window_seconds)
      return dep
  ```
- RUN: `.venv/bin/python -c "from app.core.ratelimit import hit, rate_limit_ip; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.17 — Rate-limit auth login and OTP surfaces
- DO: Edit `backend/app/routers/auth.py`: (1) add `from app.core.ratelimit import hit` and `from fastapi import Request` to imports; (2) in `login_with_phone_mpin` add a `request: Request` parameter and as the first statement `await hit("login", f"{request.client.host if request.client else 'unknown'}:{_normalize_phone(body.phone)}", 10, 600)` (10 per 10 min per IP+phone); (3) in `mpin_reset` (the OTP-request surface), after `decoded = _verify_firebase_token(body.idToken)` add `await hit("otp", decoded.get("phone_number") or decoded["uid"], 5, 600)` (5 per 10 min per phone).
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (no Redis in tests → fail-open).
- IF FAIL: fix the call placement, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.18 — Test OTP rate limit returns 429
- DO: Edit `backend/tests/test_auth.py`: append `test_otp_rate_limit_429` — request `client`, `user_store`, `fake_redis`, `monkeypatch`; monkeypatch `app.core.ratelimit.get_redis` with an async function returning `fake_redis`; seed `user_store["users/uid-1"] = {"id": "uid-1", "phone": "+919812345678"}`; call `POST /v1/auth/mpin/reset` six times with `{"idToken": "any", "newMpin": "9876"}` (conftest's fake Firebase verify returns phone `+919812345678`); assert calls 1–5 are not 429 and call 6 returns 429 with envelope code `RATE_LIMITED`.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py -k rate_limit` (cwd: `backend/`)
- EXPECT: exit 0, 1 test passes.
- IF FAIL: check the reset handler's idempotency on repeated newMpin (calls 1–5 may legitimately 200/404 — assert only "not 429" for those), adjust the seeding, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.19 — Rate-limit Razorpay order/verify endpoints
- DO: Edit `backend/app/routers/orders.py`: (1) add `from app.core.ratelimit import hit` to imports; (2) in `razorpay_order` and `razorpay_verify`, as the first statement of each: `await hit("payments", uid, 20, 60)` (20/min per user).
- RUN: `.venv/bin/python -m pytest -q tests/test_orders.py tests/test_order_lifecycle.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the call placement, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.20 — Rate-limit chat message send
- DO: Edit `backend/app/routers/chat.py`: (1) add `from app.core.ratelimit import hit` to imports; (2) in the `POST /rooms/{room_id}/messages` handler (~L164), as the first statement after the user id is known: `await hit("chat", uid, 60, 60)` (60/min per user — use the handler's actual user-id variable name).
- RUN: `.venv/bin/python -m pytest -q tests/test_chatbot.py` (cwd: `backend/`) — there is no dedicated chat-router test file; this guards against import breakage.
- EXPECT: exit 0, all pass.
- IF FAIL: run `.venv/bin/python -c "from app.routers import chat"` to surface the error, fix, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.21 — HUMAN CHECK: admin and session flows manually
- DO: HUMAN CHECK — with the dev server running (`cd backend && .venv/bin/uvicorn app.main:app --port 8000`) the human: (1) runs `cd backend && .venv/bin/python scripts/make_admin.py` for a test Firebase user per its `--help`; (2) calls any admin mutation WITHOUT `X-Audit-Reason` → expects 400 `AUDIT_REASON_REQUIRED`; (3) repeats WITH `X-Admin-Role: superadmin` + `X-Audit-Reason: manual check` → expects success; (4) confirms a non-claim account (even `admin-root`) gets 403 on `GET /v1/admin/overview`.
- RUN: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/v1/admin/overview -H "Authorization: Bearer invalid"` (requires the dev server running)
- EXPECT: output `401` (unauthenticated) — the human confirms steps 2–4 behaviors.
- IF FAIL: start the dev server with the command above and re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.22 — WS-02 checkpoint: verify and commit
- DO: Run the full WS-02 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_auth.py tests/test_admin.py && cd .. && git add -A && git commit -m "phase-00 WS-02: auth & admin-auth unification"`
- EXPECT: both test files pass; commit created (git-identity failure is non-blocking per playbook §6 — note it and continue).
- IF FAIL: fix failures caused by WS-02 files; record pre-existing unrelated failures per the ordering note — else STOP (playbook §5) with full output.
- [x]

## WS-03 — Real money rails  (see instructions.md §WS-03)

> Inline rules for every task in this workstream (P6 / global 3): integer paisa
> everywhere — NEVER floats for money; commission deducted at source; every
> financial mutation writes `audit_logs`; every new write endpoint accepts the
> `Idempotency-Key` header; no money movement outside these rails.

### Task 3.1 — Add money-rail config keys
- DO: (1) Edit `backend/app/core/config.py`: add fields `razorpay_webhook_secret: str = ""` and `bank_verify_provider: str = "stub"` to `Settings` (`bank_verify_provider` is already read by `backend/app/services/bank_verify/__init__.py` — this field un-breaks that import). (2) Edit `backend/.env.example`: append `RAZORPAY_WEBHOOK_SECRET=` and `BANK_VERIFY_PROVIDER=stub` with comment `# stub allowed only in dev/test; use razorpayx in staging/prod`.
- RUN: `.venv/bin/python -c "from app.core.config import settings; print(settings.razorpay_webhook_secret == '', settings.bank_verify_provider)"` (cwd: `backend/`)
- EXPECT: exit 0, output `True stub`.
- IF FAIL: fix field placement inside class `Settings`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.2 — Add webhook signature verifier to payments service
- DO: Edit `backend/app/services/payments.py`: append:
  ```python
  def verify_razorpay_webhook_signature(raw_body: bytes, signature: str) -> bool:
      if not settings.razorpay_webhook_secret:
          return False
      expected = hmac.new(
          settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256
      ).hexdigest()
      return hmac.compare_digest(expected, signature)
  ```
- RUN: `.venv/bin/python -c "import hmac,hashlib; from app.core.config import settings; settings.razorpay_webhook_secret='whsec'; from app.services.payments import verify_razorpay_webhook_signature as v; sig=hmac.new(b'whsec',b'{}',hashlib.sha256).hexdigest(); assert v(b'{}',sig) is True; assert v(b'{}','bad') is False; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: re-apply the edit exactly, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.3 — Create payments router with order endpoint
- DO: Create `backend/app/routers/payments.py` (new) with exactly:
  ```python
  from datetime import datetime, timezone

  from fastapi import APIRouter, Depends, Header, HTTPException
  from pydantic import BaseModel, Field

  from app.core.config import settings
  from app.core.db import get_doc, set_doc
  from app.core.deps import current_user_id
  from app.core.ratelimit import hit
  from app.services.payments import create_razorpay_order, verify_razorpay_signature

  router = APIRouter(prefix="/payments", tags=["payments"])


  def _error(status_code: int, code: str, message: str):
      raise HTTPException(status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}})


  def _now() -> str:
      return datetime.now(timezone.utc).isoformat()


  class PaymentOrderIn(BaseModel):
      amountPaisa: int = Field(..., gt=0)  # integer paisa — never floats (P6)
      purpose: str = Field(..., min_length=1)
      refId: str = Field(..., min_length=1)


  @router.post("/order")
  async def create_payment_order(
      body: PaymentOrderIn,
      uid: str = Depends(current_user_id),
      idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
  ):
      await hit("payments", uid, 20, 60)
      if not settings.razorpay_key_id:
          _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
      if idempotency_key:
          existing = await get_doc("payments_idempotency", idempotency_key)
          if existing is not None:
              return existing["response"]
      rzp = create_razorpay_order(body.amountPaisa, body.refId)
      await set_doc(
          "payment_events",
          f"order_{rzp['id']}",
          {"type": "order_created", "orderId": rzp["id"], "userId": uid, "purpose": body.purpose, "refId": body.refId, "amountPaisa": body.amountPaisa, "createdAt": _now()},
      )
      response = {"razorpayOrderId": rzp["id"], "amount": rzp["amount"], "currency": "INR", "keyId": settings.razorpay_key_id}
      if idempotency_key:
          await set_doc("payments_idempotency", idempotency_key, {"userId": uid, "response": response, "createdAt": _now()})
      return response
  ```
- RUN: `.venv/bin/python -c "from app.routers.payments import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.4 — Add payment verify endpoint
- DO: Edit `backend/app/routers/payments.py`: append:
  ```python
  class PaymentVerifyIn(BaseModel):
      razorpayOrderId: str
      razorpayPaymentId: str
      razorpaySignature: str


  @router.post("/verify")
  async def verify_payment(body: PaymentVerifyIn, uid: str = Depends(current_user_id)):
      await hit("payments", uid, 20, 60)
      if not verify_razorpay_signature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature):
          _error(400, "PAYMENT_SIGNATURE_INVALID", "payment signature verification failed")
      await set_doc(
          "payment_events",
          f"verify_{body.razorpayPaymentId}",
          {"type": "payment_verified", "orderId": body.razorpayOrderId, "paymentId": body.razorpayPaymentId, "userId": uid, "createdAt": _now()},
      )
      return {"ok": True, "status": "paid"}
  ```
- RUN: `.venv/bin/python -c "from app.routers.payments import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the appended code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.5 — Add admin refund endpoint
- PRECONDITION: `grep -n "def admin_action" backend/app/core/deps.py` — if this fails, STOP the phase (playbook §5): WS-02 task 2.3 is missing.
- DO: Edit `backend/app/routers/payments.py`: (1) add imports `from app.core.deps import admin_action` and `from app.services.payments import refund_razorpay_payment`; (2) append:
  ```python
  class RefundIn(BaseModel):
      amountPaisa: int = Field(..., gt=0)
      reason: str = Field(..., min_length=3)


  @router.post("/{payment_id}/refund")
  async def refund_payment(
      payment_id: str,
      body: RefundIn,
      _audit: dict = Depends(admin_action("REFUND_PAYMENT")),
  ):
      result = await refund_razorpay_payment(payment_id, body.amountPaisa)
      await set_doc(
          "payment_events",
          f"refund_{result.get('id', payment_id)}",
          {"type": "refund_processed", "paymentId": payment_id, "refundId": result.get("id"), "amountPaisa": body.amountPaisa, "reason": body.reason, "createdAt": _now()},
      )
      return {"ok": True, "refund": result}
  ```
- RUN: `.venv/bin/python -c "from app.routers.payments import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.6 — Add signed Razorpay webhook endpoint
- DO: Edit `backend/app/routers/payments.py`: (1) add imports `import json`, `from fastapi import Request`, `from app.services.payments import verify_razorpay_webhook_signature`; (2) append:
  ```python
  @router.post("/webhook")
  async def razorpay_webhook(request: Request):
      raw = await request.body()
      signature = request.headers.get("X-Razorpay-Signature", "")
      if not verify_razorpay_webhook_signature(raw, signature):
          _error(400, "WEBHOOK_SIGNATURE_INVALID", "webhook signature verification failed")
      event = json.loads(raw)
      event_id = event.get("id")
      if not event_id:
          _error(400, "WEBHOOK_EVENT_ID_MISSING", "webhook event has no id")
      if await get_doc("payment_events", event_id) is not None:
          return {"ok": True, "duplicate": True}
      await set_doc(
          "payment_events",
          event_id,
          {"eventId": event_id, "type": event.get("event"), "payload": event, "receivedAt": _now()},
      )
      return {"ok": True}
  ```
- RUN: `.venv/bin/python -c "from app.routers.payments import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the appended code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.7 — Register payments router in main app
- DO: Edit `backend/app/main.py`: (1) add `payments,` to the `from app.routers import (...)` list (alphabetical position, after `pnl,`); (2) add `app.include_router(payments.router, prefix="/v1")` next to the other includes.
- RUN: `.venv/bin/python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/v1/payments')])"` (cwd: `backend/`)
- EXPECT: exit 0; output lists `/v1/payments/order`, `/v1/payments/verify`, `/v1/payments/{payment_id}/refund`, `/v1/payments/webhook`.
- IF FAIL: fix the import/include lines, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.8 — Register payments modules in conftest
- DO: Edit `backend/tests/conftest.py`: add `"app.routers.payments"` and `"app.services.payments"` to BOTH the `get_doc`/`set_doc` module tuple (~L48–110) and the `query` module tuple (~L147–212).
- RUN: `.venv/bin/python -m pytest -q tests/test_infra.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (conftest loads without error).
- IF FAIL: fix the tuple edits, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.9 — Create payments webhook and idempotency tests
- DO: Create `backend/tests/test_payments.py` (new) with:
  1. `test_webhook_bad_signature_rejected` — POST `/v1/payments/webhook` with a random `X-Razorpay-Signature` → 400, envelope code `WEBHOOK_SIGNATURE_INVALID` (accept either `error` or `detail` envelope shape until WS-06 lands).
  2. `test_webhook_good_signature_persists_event` — monkeypatch `app.core.config.settings.razorpay_webhook_secret` to `"whsec"`, compute the HMAC-SHA256 hex of the raw body with that secret, POST the body with the correct signature → `{"ok": true}`; assert `user_store[f"payment_events/{event_id}"]` exists.
  3. `test_webhook_replay_is_idempotent` — same event POSTed twice with valid signature → second response `{"ok": true, "duplicate": true}`; exactly ONE `payment_events` doc for the event id.
  4. `test_order_idempotent_on_key` — monkeypatch `app.core.config.settings.razorpay_key_id` to `"rzp_test_x"`, login/seed a user per the existing test_auth patterns, POST `/v1/payments/order` twice with the SAME `Idempotency-Key` header → both responses carry the same `razorpayOrderId` (the dev order id is derived from `refId`, so also assert only ONE `payments_idempotency` doc exists).
  Use the existing `client`, `user_store`, `monkeypatch` fixtures; seed the caller user with `user_store["users/uid-1"] = {"id": "uid-1"}` and send `Authorization: Bearer <access token>` built via `app.services.tokens.create_access_token("uid-1")` — copy this pattern from `tests/test_orders.py` if it already exists there.
- RUN: `.venv/bin/python -m pytest -q tests/test_payments.py` (cwd: `backend/`)
- EXPECT: exit 0, `4 passed`.
- IF FAIL: print the failing response body once, align the test to the implemented contract (tasks 3.3–3.6 are the truth), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.10 — Add reconcile_payments to payments service
- DO: Edit `backend/app/services/payments.py`: append:
  ```python
  async def reconcile_payments() -> dict:
      """Diff Razorpay payments (API list) against persisted payment_events.
      Discrepancies are written to audit_logs for the admin alert surface."""
      from app.core.db import get_doc, set_doc

      if not settings.razorpay_key_id:
          return {"skipped": True, "reason": "razorpay not configured"}
      async with httpx.AsyncClient() as client:
          resp = await client.get(
              "https://api.razorpay.com/v1/payments",
              auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
              params={"count": 100},
          )
      items = resp.json().get("items", [])
      mismatches = []
      for payment in items:
          pid = payment.get("id")
          if await get_doc("payment_events", f"verify_{pid}") is None:
              mismatches.append(pid)
              await set_doc(
                  "audit_logs",
                  f"aud_recon_{pid}",
                  {"action": "PAYMENT_RECON_MISMATCH", "adminId": "system", "role": "system", "targetId": pid, "reason": "razorpay payment missing from payment_events", "at": datetime_now_iso()},
              )
      return {"checked": len(items), "mismatched": len(mismatches), "mismatchIds": mismatches}
  ```
  and add at the top of the file `from datetime import datetime, timezone` plus helper `def datetime_now_iso() -> str: return datetime.now(timezone.utc).isoformat()`.
- RUN: `.venv/bin/python -c "from app.services.payments import reconcile_payments; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.11 — Add reconciliation job endpoint
- DO: Edit `backend/app/routers/jobs.py`: (1) add `from app.services.payments import reconcile_payments` to imports; (2) append:
  ```python
  @router.post("/payments/reconcile")
  async def reconcile_payments_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
      _check_cron_secret(x_cron_secret)
      return await reconcile_payments()
  ```
- RUN: `.venv/bin/python -c "from app.routers.jobs import router; print([r.path for r in router.routes])"` (cwd: `backend/`)
- EXPECT: exit 0; output contains `/jobs/payments/reconcile`.
- IF FAIL: fix the endpoint, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.12 — Add reconciliation test
- DO: Edit `backend/tests/test_payments.py`: append `test_reconcile_reports_missing_events` — monkeypatch `app.core.config.settings.razorpay_key_id`/`razorpay_key_secret` to non-empty; monkeypatch `httpx.AsyncClient.get` (or `app.services.payments.httpx.AsyncClient`) with a stub returning `{"items": [{"id": "pay_missing1"}]}` (follow the fake-httpx pattern used elsewhere in the suite if one exists — check `grep -rn "AsyncClient" backend/tests | head` first); call `reconcile_payments()` directly with `await`; assert result `{"checked": 1, "mismatched": 1, ...}` and that `user_store["audit_logs/aud_recon_pay_missing1"]` exists.
- RUN: `.venv/bin/python -m pytest -q tests/test_payments.py` (cwd: `backend/`)
- EXPECT: exit 0, `5 passed`.
- IF FAIL: align the httpx stub to the real call signature, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.13 — Create escrow service for Razorpay Route
- DO: Create `backend/app/services/escrow.py` (new) with exactly:
  ```python
  import logging
  from datetime import datetime, timedelta, timezone

  import httpx

  from app.core.config import settings
  from app.core.db import get_doc, query, set_doc

  log = logging.getLogger(__name__)

  DISPUTE_WINDOW_HOURS = 24
  T0_ROLES = {"seller", "broker"}  # T+0 auto-release roles; all others T+1


  def _now() -> str:
      return datetime.now(timezone.utc).isoformat()


  def _configured() -> bool:
      return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


  async def ensure_linked_account(user_id: str, role: str) -> dict:
      """Razorpay Route linked account for a seller/transporter/equipment owner/broker."""
      existing = await get_doc("razorpay_accounts", user_id)
      if existing is not None:
          return existing
      if not _configured():
          return {"skipped": True}
      async with httpx.AsyncClient() as client:
          resp = await client.post(
              "https://api.razorpay.com/v2/accounts",
              auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
              json={"email": f"user-{user_id}@placeholder.invalid", "type": "route"},
          )
      account = {"userId": user_id, "role": role, "accountId": resp.json().get("id"), "createdAt": _now()}
      await set_doc("razorpay_accounts", user_id, account)
      return account


  def schedule_release(purchase: dict) -> None:
      """Mutates the purchase doc: handover-OTP confirm starts the release clock.
      T+0/T+1 after a 24 h silent dispute window (instructions.md §WS-03 step 3)."""
      handover = purchase.get("handover") or {}
      verified_at = (handover.get("verifiedAt") or _now()).replace("Z", "+00:00")
      base = datetime.fromisoformat(verified_at)
      role = purchase.get("sellerRole", "seller")
      release_at = base + timedelta(hours=DISPUTE_WINDOW_HOURS)
      if role not in T0_ROLES:
          release_at += timedelta(days=1)
      purchase["escrowStatus"] = "release_pending"
      purchase["releaseAt"] = release_at.isoformat()


  async def pause_release(purchase_id: str, dispute_id: str) -> None:
      purchase = await get_doc("purchases", purchase_id)
      if purchase is None:
          return
      purchase["escrowStatus"] = "disputed_hold"
      purchase["disputeId"] = dispute_id
      purchase["updatedAt"] = _now()
      await set_doc("purchases", purchase_id, purchase)


  async def release_due(now_iso: str) -> dict:
      """Release purchases past the silent window with no open dispute.
      Real-money transfer via Razorpay Route when configured; integer paisa only."""
      due = await query("purchases", [("escrowStatus", "==", "release_pending")], limit=500)
      released = 0
      for purchase in due:
          if (purchase.get("releaseAt") or "9999") > now_iso:
              continue
          if purchase.get("disputeId"):
              continue
          purchase["escrowStatus"] = "released"
          purchase["releasedAt"] = _now()
          escrow = purchase.get("escrow") or {}
          net_paisa = int(escrow.get("netRelease") or 0) * 100
          if _configured() and net_paisa > 0:
              account = await get_doc("razorpay_accounts", purchase.get("sellerId") or purchase.get("farmerId") or "")
              if account and account.get("accountId"):
                  async with httpx.AsyncClient() as client:
                      await client.post(
                          f"https://api.razorpay.com/v1/payments/{purchase.get('razorpayPaymentId')}/transfers",
                          auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                          json={"transfers": [{"account": account["accountId"], "amount": net_paisa, "currency": "INR"}]},
                      )
          await set_doc("purchases", purchase["id"], purchase)
          await set_doc(
              "audit_logs",
              f"aud_escrow_{purchase['id']}",
              {"action": "ESCROW_RELEASED", "adminId": "system", "role": "system", "targetId": purchase["id"], "reason": "dispute window elapsed", "at": _now()},
          )
          released += 1
      return {"released": released, "transfersSkipped": not _configured()}
  ```
- RUN: `.venv/bin/python -c "from app.services.escrow import schedule_release, pause_release, release_due, ensure_linked_account; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.14 — Wire release clock into handover OTP verify
- DO: Edit `backend/app/routers/purchase_settlement.py` in `verify_handover` (~L129): (1) add `from app.services.escrow import schedule_release` to imports; (2) immediately after `handover["verifiedAt"] = _now()` and BEFORE `await set_doc("purchases", purchase_id, purchase)`, add `schedule_release(purchase)` — this stores `escrowStatus: "release_pending"` and `releaseAt` on the purchase doc in the same write.
- RUN: `.venv/bin/python -m pytest -q tests/test_purchases.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: verify the insert is before the `set_doc` call, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.15 — Add dispute endpoint pausing release
- DO: Edit `backend/app/routers/purchase_settlement.py`: (1) add `from app.services.escrow import pause_release` to imports; (2) append (there is no existing dispute surface — this is the seam instructions.md §WS-03 step 3 requires):
  ```python
  class DisputeIn(BaseModel):
      reason: str = Field(..., min_length=3)


  @router.post("/{purchase_id}/disputes", status_code=201)
  async def open_dispute(purchase_id: str, body: DisputeIn, uid: str = Depends(current_user_id)):
      purchase = await _participant(purchase_id, uid)
      if purchase.get("escrowStatus") not in ("held", "release_pending"):
          _error(400, "INVALID_STATUS_TRANSITION", "no active escrow to dispute")
      now = _now()
      if purchase.get("escrowStatus") == "release_pending" and (purchase.get("releaseAt") or "9999") <= now:
          _error(400, "DISPUTE_WINDOW_CLOSED", "the 24h dispute window has closed")
      dispute_id = f"disp_{purchase_id}"
      await set_doc(
          "disputes",
          dispute_id,
          {"disputeId": dispute_id, "purchaseId": purchase_id, "openedBy": uid, "reason": body.reason, "status": "open", "createdAt": now},
      )
      await pause_release(purchase_id, dispute_id)
      return {"disputeId": dispute_id, "status": "open"}
  ```
  (Check the file's imports — it already imports `BaseModel`/`Field` for `QcIn`; reuse them.)
- RUN: `.venv/bin/python -m pytest -q tests/test_purchases.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix imports/model placement, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.16 — Add escrow release job endpoint
- DO: Edit `backend/app/routers/jobs.py`: (1) add `from datetime import datetime, timezone` (extend the existing datetime import) and `from app.services.escrow import release_due` to imports; (2) append:
  ```python
  @router.post("/escrow/release")
  async def release_escrow_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
      _check_cron_secret(x_cron_secret)
      return await release_due(datetime.now(timezone.utc).isoformat())
  ```
- RUN: `.venv/bin/python -c "from app.routers.jobs import router; print([r.path for r in router.routes])"` (cwd: `backend/`)
- EXPECT: exit 0; output contains `/jobs/escrow/release`.
- IF FAIL: fix the endpoint, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.17 — Register escrow modules in conftest and test escrow
- DO: (1) Edit `backend/tests/conftest.py`: add `"app.services.escrow"` to BOTH the `get_doc`/`set_doc` tuple and the `query` tuple; add `"app.routers.purchase_settlement"` to the `get_doc`/`set_doc` tuple and the `query` tuple (only its `set_doc` is patched today). (2) Edit `backend/tests/test_purchases.py`: append escrow-timing tests:
  1. `test_escrow_not_released_before_window` — seed `user_store["purchases/p1"]` with `{"id": "p1", "escrowStatus": "release_pending", "releaseAt": "<now+25h ISO>", "escrow": {"status": "held", "netRelease": 500}}`; `await release_due(now_iso)` → `{"released": 0, ...}`.
  2. `test_escrow_released_after_window` — same but `releaseAt` in the past → `released == 1`; the stored doc has `escrowStatus == "released"` and an `audit_logs/aud_escrow_p1` doc exists.
  3. `test_dispute_pauses_release` — `releaseAt` in the past but `disputeId` set → `released == 0`.
  Import `release_due` from `app.services.escrow`; compute ISO strings with `datetime.now(timezone.utc) ± timedelta`.
- RUN: `.venv/bin/python -m pytest -q tests/test_purchases.py -k escrow` (cwd: `backend/`)
- EXPECT: exit 0, `3 passed`.
- IF FAIL: align seed docs to what `release_due` reads (`id`, `escrowStatus`, `releaseAt`, `disputeId`, `escrow.netRelease`), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.18 — Create RazorpayX payouts service
- DO: Create `backend/app/services/payouts.py` (new) with exactly:
  ```python
  import logging

  import httpx

  from app.core.config import settings
  from app.core.db import query, set_doc

  log = logging.getLogger(__name__)


  async def pay_settlement(settlement: dict, dry_run: bool) -> dict:
      """Move one settlement's money via RazorpayX to the beneficiary's VERIFIED
      primary bank account. Unverified beneficiaries go onHold with a reason
      (existing field semantics — kept). Integer paisa only (P6)."""
      entity_id = settlement["entityId"]
      accounts = await query(f"users/{entity_id}/bank_accounts", limit=10)
      verified = next(
          (a for a in accounts if a.get("verifyStatus") == "verified" and a.get("isPrimary")),
          None,
      ) or next((a for a in accounts if a.get("verifyStatus") == "verified"), None)
      if verified is None:
          settlement["status"] = "onHold"
          settlement["holdReason"] = "no verified bank account"
          await set_doc("settlements", settlement["id"], settlement)
          return settlement
      if dry_run:
          settlement["status"] = "dry_run"
          await set_doc("settlements", settlement["id"], settlement)
          return settlement
      if not (settings.razorpay_key_id and settings.razorpay_key_secret):
          settlement["status"] = "onHold"
          settlement["holdReason"] = "razorpayx not configured"
          await set_doc("settlements", settlement["id"], settlement)
          return settlement
      amount_paisa = int(settlement.get("netRupees") or settlement.get("grossRupees") or 0) * 100
      async with httpx.AsyncClient() as client:
          fund = await client.post(
              "https://api.razorpay.com/v1/fund_accounts",
              auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
              json={"account_type": "bank_account", "bank_account": {"name": verified["accountHolder"], "ifsc": verified["ifsc"], "account_number": verified["accountNumber"]}},
          )
          payout = await client.post(
              "https://api.razorpay.com/v1/payouts",
              auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
              json={"fund_account_id": fund.json().get("id"), "amount": amount_paisa, "currency": "INR", "mode": "IMPS", "purpose": "payout", "reference_id": settlement["id"]},
          )
      settlement["status"] = "paid"
      settlement["payoutId"] = payout.json().get("id")
      await set_doc("settlements", settlement["id"], settlement)
      await set_doc(
          "audit_logs",
          f"aud_payout_{settlement['id']}",
          {"action": "SETTLEMENT_PAYOUT", "adminId": "system", "role": "system", "targetId": settlement["id"], "reason": "weekly settlement payout", "at": settlement.get("updatedAt") or ""},
      )
      return settlement
  ```
- RUN: `.venv/bin/python -c "from app.services.payouts import pay_settlement; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.19 — Wire payouts and onHold into settlements run
- DO: Edit `backend/app/services/settlements.py`: (1) add `from app.services.payouts import pay_settlement` to imports; (2) in `_config()`'s seeded default config dict add keys `"payoutsEnabled": False` and `"dryRun": True` (operator flips these in `platform_config/settlements` — dry-run mode per run config, instructions.md §WS-03 step 4); (3) in `run_settlements`, immediately after each settlement doc is written/updated (inside the `for role, entities in totals.items():` loop, after `set_doc("settlements", doc_id, doc)` or the equivalent existing write), add:
  ```python
  if config.get("payoutsEnabled"):
      await pay_settlement(doc, dry_run=bool(config.get("dryRun")))
  ```
  Use the actual variable name of the settlement dict in the existing code (read the loop first).
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (default config has `payoutsEnabled: False` — no behavior change).
- IF FAIL: fix the insert point, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.20 — Add onHold payout test
- DO: (1) Edit `backend/tests/conftest.py`: add `"app.services.payouts"` to BOTH the `get_doc`/`set_doc` tuple and the `query` tuple. (2) Edit `backend/tests/test_settlements.py` (or `backend/tests/test_payments.py` if settlements tests are elsewhere — check): append `test_payout_onhold_without_verified_bank` — seed `user_store["settlements/st_x"]` with `{"id": "st_x", "entityId": "uid-nob", "grossRupees": 1000, "netRupees": 900}` and NO bank accounts for `uid-nob`; `result = await pay_settlement(dict(user_store["settlements/st_x"]), dry_run=False)`; assert `result["status"] == "onHold"` and `result["holdReason"] == "no verified bank account"` and the stored doc matches.
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py -k onhold` (cwd: `backend/`)
- EXPECT: exit 0, `1 passed`.
- IF FAIL: confirm the fake `query` sees the subcollection path `users/uid-nob/bank_accounts` (seed it via `user_store[f"users/uid-nob/bank_accounts/{doc_id}"]` when testing the verified path), fix, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.21 — Create RazorpayX penny-drop adapter
- DO: Create `backend/app/services/bank_verify/razorpayx.py` (new — `bank_verify/__init__.py` already imports `RazorpayXBankVerifyAdapter` from this path, so the package import is broken until this file exists) with exactly:
  ```python
  import httpx

  from app.core.config import settings
  from app.services.bank_verify.base import BankVerifyAdapter


  class RazorpayXBankVerifyAdapter(BankVerifyAdapter):
      """Real penny-drop via RazorpayX fund-account validation (₹1 = 100 paisa)."""

      async def penny_drop(self, account_number: str, ifsc: str, account_holder: str) -> dict:
          if not (settings.razorpay_key_id and settings.razorpay_key_secret):
              return {"verified": False, "accountHolderMatch": False}
          async with httpx.AsyncClient() as client:
              resp = await client.post(
                  "https://api.razorpay.com/v1/fund_accounts/validations",
                  auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                  json={
                      "account_number": account_number,
                      "fund_account": {
                          "account_type": "bank_account",
                          "bank_account": {"name": account_holder, "ifsc": ifsc, "account_number": account_number},
                      },
                      "amount": 100,
                      "currency": "INR",
                  },
                  timeout=15.0,
              )
          data = resp.json()
          status = data.get("status")
          if resp.status_code >= 400 or status in (None, "failed"):
              return {"verified": False, "accountHolderMatch": False}
          results = data.get("results") or {}
          return {
              "verified": status == "completed",
              "accountHolderMatch": results.get("account_status") == "active",
          }
  ```
- RUN: `.venv/bin/python -c "from app.services.bank_verify import get_bank_verify_adapter; a = get_bank_verify_adapter(); print(type(a).__name__)"` (cwd: `backend/`)
- EXPECT: exit 0, output `StubBankVerifyAdapter` (default provider is stub; env=dev allows it).
- IF FAIL: the import error names the missing piece — fix `razorpayx.py` or the config key from task 3.1, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.22 — Add penny-drop failure-path test
- DO: Edit `backend/tests/test_bank_accounts.py`: append `test_penny_drop_invalid_ifsc_fails` — monkeypatch `app.services.bank_verify.razorpayx.httpx.AsyncClient` (or its `post` method) with a stub whose `post` returns an object with `status_code = 400` and `.json()` returning `{"error": {"description": "invalid IFSC"}}`; monkeypatch `app.core.config.settings.razorpay_key_id`/`razorpay_key_secret` non-empty; instantiate `RazorpayXBankVerifyAdapter` directly and `await adapter.penny_drop("1234567890", "BAD0IFSC", "Test Name")`; assert result == `{"verified": False, "accountHolderMatch": False}`. Also assert `get_bank_verify_adapter()` raises `ValueError` when `settings.env` is monkeypatched to `"prod"` and provider is `"stub"` (stub removed from any non-dev path).
- RUN: `.venv/bin/python -m pytest -q tests/test_bank_accounts.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass including the new test.
- IF FAIL: align the httpx stub signature, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.23 — Add TDS and GST rates to settlements config
- DO: Edit `backend/app/services/settlements.py` in `_config()`'s seeded default config dict: add `"tdsRateBps": 10` (TDS section 194-O at 0.1% in basis points — operator-adjustable via `platform_config/settlements`) and `"gstRateBps": 1800` (GST 18% on commission, basis points). No other change in this task.
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the dict edit, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.24 — Write tds_ledger entries at settlement
- DO: Edit `backend/app/services/settlements.py` in `run_settlements`: inside the settlement-write loop, immediately after each settlement doc write, add:
  ```python
  gross_paisa = gross * 100
  tds_paisa = gross_paisa * int(config["tdsRateBps"]) // 10000  # integer paisa math only
  await set_doc(
      "tds_ledger",
      f"tds_{doc_id}",
      {"txnId": doc_id, "persona": role, "grossPaisa": gross_paisa, "tdsPaisa": tds_paisa, "section": "194-O", "period": period_start},
  )
  ```
  Use the loop's actual variable names (`gross`, `doc_id`, `role` per the existing code — read the loop first). Every financial mutation already lands in a collection; the ledger write is the audit trail for 194-O.
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix variable names to match the existing loop, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.25 — Add TDS math test in integer paisa
- DO: Edit `backend/tests/test_settlements.py`: append `test_tds_ledger_sums_to_gross` — run `run_settlements` over a seeded period that produces at least one settlement (copy the seeding pattern from the nearest existing settlements test), then collect every `user_store` key starting with `tds_ledger/`; assert: for each ledger doc, `tdsPaisa == grossPaisa * 10 // 10000` (the seeded 10 bps rate), all values are `int` (never float), and `sum(doc["grossPaisa"]) == sum(settlement grossRupees) * 100` for the corresponding settlements.
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py -k tds` (cwd: `backend/`)
- EXPECT: exit 0, `1 passed`.
- IF FAIL: align the assertion to the seeded fixture's gross values, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.26 — Create invoices service with PDF output
- DO: Create `backend/app/services/invoices.py` (new): read `backend/app/services/reports.py` FIRST and mirror its reportlab/PDF pattern. The new module must contain:
  ```python
  async def issue_invoice(kind: str, ref_id: str, business_id: str, taxable_paisa: int, gst_rate_bps: int, period: str) -> dict:
      """kind: 'vyapari_sale' | 'commission'. Integer paisa in, integer paisa stored."""
      gst_paisa = taxable_paisa * gst_rate_bps // 10000
      invoice = {
          "invoiceId": f"inv_{kind}_{ref_id}",
          "kind": kind,
          "refId": ref_id,
          "businessId": business_id,
          "taxablePaisa": taxable_paisa,
          "gstPaisa": gst_paisa,
          "totalPaisa": taxable_paisa + gst_paisa,
          "period": period,
          "createdAt": <iso now>,
      }
      # persist to the `invoices` collection via set_doc, then
      invoice["pdfPath"] = render_invoice_pdf(invoice)
      await set_doc("invoices", invoice["invoiceId"], invoice)
      return invoice


  def render_invoice_pdf(invoice: dict) -> str:
      """Render the GST invoice PDF with reportlab into backend/.local_uploads/invoices/
      (same storage root pattern as services/storage.py). Returns the file path."""
  ```
  Implement `render_invoice_pdf` following `services/reports.py`'s exact reportlab usage; the PDF must show invoice id, period, taxable/GST/total amounts formatted from paisa (`paisa // 100`.`paisa % 100` — never float division).
- RUN: `.venv/bin/python -c "from app.services.invoices import issue_invoice, render_invoice_pdf; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports/reportlab usage to match `services/reports.py`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.27 — Wire commission and vyapari sale invoices
- DO: (1) Edit `backend/app/services/settlements.py`: in the settlement-write loop (same spot as task 3.24), after the tds_ledger write add a platform commission invoice: `await issue_invoice("commission", doc_id, entity_id, commission * 100, int(config["gstRateBps"]), period_start)` with `from app.services.invoices import issue_invoice` imported at top and the loop's actual variable names. (2) Edit `backend/app/routers/purchases.py` in the existing `_issue_invoice` helper (~L53 — read it first): after its current logic, persist a vyapari-sale GST invoice via `issue_invoice("vyapari_sale", purchase["id"], purchase["buyerId"], int((purchase.get("finalAmount") or purchase.get("totalAmount") or 0)) * 100, 1800, <current period YYYY-MM>)` — the sale amount converted to integer paisa; add the import.
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py tests/test_purchases.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix variable names/import cycles (if a circular import appears, do the `issue_invoice` import inside the function), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.28 — Add invoice generation test
- DO: (1) Edit `backend/tests/conftest.py`: add `"app.services.invoices"` to BOTH the `get_doc`/`set_doc` tuple and the `query` tuple. (2) Edit `backend/tests/test_settlements.py`: append `test_commission_invoice_written` — reuse the fixture from `test_tds_ledger_sums_to_gross`; after `run_settlements`, assert an `invoices/inv_commission_<doc_id>` doc exists whose `gstPaisa == taxablePaisa * 1800 // 10000` and `totalPaisa == taxablePaisa + gstPaisa`, all ints; assert `pdfPath` endswith `.pdf` and the file exists on disk (clean it up at test end).
- RUN: `.venv/bin/python -m pytest -q tests/test_settlements.py -k invoice` (cwd: `backend/`)
- EXPECT: exit 0, `1 passed`.
- IF FAIL: align to the real invoice doc shape from task 3.26, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.29 — HUMAN CHECK: staging money flow end-to-end
- DO: HUMAN CHECK — against the staging backend with real Razorpay TEST keys (human supplies them via env): (1) `POST /v1/payments/order` with amountPaisa + Idempotency-Key → Razorpay order id returned; (2) pay with a Razorpay test card; (3) confirm the signed webhook arrives (check a `payment_events` doc exists and its signature verified — replay it with `curl` and the correct `X-Razorpay-Signature` if needed); (4) `POST /v1/payments/verify` → success; (5) admin refund round-trip; (6) run `POST /v1/jobs/payments/reconcile` with the cron secret → `mismatched: 0`; (7) purchase flow → handover OTP → confirm `escrowStatus: release_pending` + `releaseAt` on the purchase doc; (8) weekly settlement run with payoutsEnabled → verified account paid, unverified account `onHold`; (9) inspect `audit_logs` for every mutation.
- RUN: `curl -s -X POST http://localhost:8000/v1/jobs/payments/reconcile -H "X-Cron-Secret: $CRON_SECRET"` (human substitutes the real staging URL/secret; requires the server running)
- EXPECT: JSON response with `checked`/`mismatched` fields; the human confirms steps 1–9.
- IF FAIL: record which numbered step failed and STOP (playbook §5) with the full response — staging money flows must not be faked.
- [ ]

### Task 3.30 — WS-03 checkpoint: verify and commit
- DO: Run the full WS-03 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_admin_finance.py tests/test_booking_accept.py -k "payment or settlement or escrow or tds" && .venv/bin/python -m pytest -q tests/test_payments.py tests/test_settlements.py tests/test_purchases.py tests/test_bank_accounts.py && cd .. && git add -A && git commit -m "phase-00 WS-03: real money rails"`
- EXPECT: all listed test selections pass; commit created. (The full-suite command from instructions.md runs at the WS-06 checkpoint and the phase-final gate, when the 45 pre-existing failures are repaired.)
- IF FAIL: fix failures in files WS-03 touched; record pre-existing unrelated failures per the ordering note — else STOP (playbook §5) with full output.
- [ ]

## WS-04 — KYC pipeline  (see instructions.md §WS-04)

### Task 4.1 — Create KYC service with document matrices
- DO: Create `backend/app/services/kyc.py` (new) with exactly:
  ```python
  """KYC pipeline: kyc_cases collection + per-persona document matrices
  (instructions.md §WS-04 steps 1-2, matrices from features/*.md)."""
  import re
  from datetime import datetime, timezone

  from app.core.db import get_doc, query, set_doc

  COLLECTION = "kyc_cases"

  # base for every persona: masked Aadhaar (DigiLocker/offline-eKYC), PAN, penny-drop bank
  BASE_DOCS = ["aadhaar", "pan", "bank_penny_drop"]

  DOC_MATRICES: dict[str, list[str]] = {
      "farmer": BASE_DOCS,
      "farmLandlord": BASE_DOCS + ["land_712", "tax_receipt"],
      "transport": BASE_DOCS + ["rc", "dl"],
      "seller": BASE_DOCS + ["apmc_licence", "gst"],  # vyapari
      "broker": BASE_DOCS + ["arhtiya_licence"],
      "equipmentRental": BASE_DOCS + ["rc", "insurance", "operator_licence"],
      "dairyManager": BASE_DOCS + ["fssai"],
      "exporter": BASE_DOCS + ["iec", "apeda"],
      "instructor": BASE_DOCS + ["instructor_credential"],
      "directBuyer": BASE_DOCS + ["gst", "fssai"],
  }

  EXPIRY_TRACKED = {"rc", "insurance", "fitness", "apmc_licence", "arhtiya_licence", "operator_licence", "instructor_credential"}
  RECURRING_REVERIFY = {"instructor_credential"}


  def _now() -> str:
      return datetime.now(timezone.utc).isoformat()


  def mask_aadhaar(value: str) -> str:
      """Never persist an unmasked Aadhaar number (global rule 11)."""
      digits = re.sub(r"\D", "", value or "")
      if len(digits) >= 4:
          return f"XXXXXXXX{digits[-4:]}"
      return "XXXXXXXX"


  def required_docs(persona: str) -> list[str]:
      return DOC_MATRICES.get(persona, BASE_DOCS)


  async def get_case(case_id: str) -> dict | None:
      return await get_doc(COLLECTION, case_id)


  async def save_case(case: dict) -> dict:
      await set_doc(COLLECTION, case["caseId"], case)
      return case
  ```
- RUN: `.venv/bin/python -c "from app.services.kyc import DOC_MATRICES, mask_aadhaar, required_docs; assert mask_aadhaar('1234 5678 9012') == 'XXXXXXXX9012'; assert 'rc' in required_docs('transport'); print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module to match the spec above, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.2 — Create KYC router with case submission
- DO: Create `backend/app/routers/kyc.py` (new) with exactly:
  ```python
  from datetime import datetime, timezone

  from fastapi import APIRouter, Depends, HTTPException, UploadFile
  from pydantic import BaseModel, Field

  from app.core.db import query
  from app.core.deps import current_user_id
  from app.services.kyc import COLLECTION, DOC_MATRICES, get_case, mask_aadhaar, required_docs, save_case
  from app.services.storage import upload_user_file, validate_upload

  router = APIRouter(prefix="/kyc", tags=["kyc"])


  def _error(status_code: int, code: str, message: str):
      raise HTTPException(status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}})


  def _now() -> str:
      return datetime.now(timezone.utc).isoformat()


  class KycDocIn(BaseModel):
      type: str
      storagePath: str = ""
      expiresAt: str | None = None
      extractedRef: str | None = None


  class KycCaseIn(BaseModel):
      persona: str = Field(..., min_length=1)
      docs: list[KycDocIn] = Field(default_factory=list)


  @router.post("/cases", status_code=201)
  async def submit_case(body: KycCaseIn, uid: str = Depends(current_user_id)):
      if body.persona not in DOC_MATRICES:
          _error(422, "INVALID_PERSONA", "unknown persona for KYC")
      allowed = set(required_docs(body.persona))
      for doc in body.docs:
          if doc.type not in allowed:
              _error(422, "INVALID_DOC_TYPE", f"{doc.type} is not required for {body.persona}")
      case_id = f"kyc_{uid}_{body.persona}"
      docs = [
          {
              "docId": f"{case_id}_{d.type}",
              "type": d.type,
              "storagePath": d.storagePath,
              "status": "pending",
              "reason": None,
              "expiresAt": d.expiresAt,
              "extractedRef": mask_aadhaar(d.extractedRef) if d.type == "aadhaar" and d.extractedRef else d.extractedRef,
          }
          for d in body.docs
      ]
      case = {
          "caseId": case_id,
          "userId": uid,
          "persona": body.persona,
          "docs": docs,
          "status": "pending",
          "submittedAt": _now(),
          "reviewedBy": None,
          "reviewedAt": None,
      }
      await save_case(case)
      return case
  ```
- RUN: `.venv/bin/python -c "from app.routers.kyc import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.3 — Add status and doc re-upload endpoints
- DO: Edit `backend/app/routers/kyc.py`: append:
  ```python
  @router.get("/status")
  async def kyc_status(uid: str = Depends(current_user_id)):
      cases = await query(COLLECTION, [("userId", "==", uid)], limit=50)
      return {"cases": cases}


  class ReuploadIn(BaseModel):
      type: str
      storagePath: str = Field(..., min_length=1)
      expiresAt: str | None = None


  @router.post("/cases/{case_id}/docs")
  async def reupload_doc(case_id: str, body: ReuploadIn, uid: str = Depends(current_user_id)):
      case = await get_case(case_id)
      if case is None or case.get("userId") != uid:
          _error(404, "CASE_NOT_FOUND", "kyc case not found")
      target = next((d for d in case["docs"] if d["type"] == body.type), None)
      if target is None:
          _error(404, "DOC_NOT_FOUND", "no such doc in this case")
      if target["status"] != "rejected":
          _error(409, "DOC_NOT_REJECTED", "only rejected docs can be re-uploaded")
      target.update({"storagePath": body.storagePath, "status": "pending", "reason": None, "expiresAt": body.expiresAt})
      case["status"] = "pending"
      case["reviewedBy"] = None
      case["reviewedAt"] = None
      await save_case(case)
      return case
  ```
- RUN: `.venv/bin/python -c "from app.routers.kyc import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the appended code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.4 — Add matrix and upload endpoints
- DO: Edit `backend/app/routers/kyc.py`: append:
  ```python
  @router.get("/matrix")
  async def kyc_matrix():
      return {"matrices": DOC_MATRICES}


  @router.post("/upload")
  async def kyc_upload(file: UploadFile, uid: str = Depends(current_user_id)):
      data = await validate_upload(file)
      storage_path, _size = upload_user_file(uid, data, file.filename or "doc", file.content_type or "image/jpeg", prefix="kyc")
      return {"storagePath": storage_path}
  ```
  (Check `upload_user_file`'s real signature in `backend/app/services/storage.py` first — it is sync and returns `(blob_path, size)`.)
- RUN: `.venv/bin/python -c "from app.routers.kyc import router; print([r.path for r in router.routes])"` (cwd: `backend/`)
- EXPECT: exit 0; output contains `/kyc/cases`, `/kyc/status`, `/kyc/matrix`, `/kyc/upload`, `/kyc/cases/{case_id}/docs`.
- IF FAIL: align to the real `upload_user_file` signature, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.5 — Register KYC router in main app
- DO: Edit `backend/app/main.py`: add `kyc,` to the `from app.routers import (...)` list (alphabetical, after `jobs,`) and `app.include_router(kyc.router, prefix="/v1")` beside the other includes.
- RUN: `.venv/bin/python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/v1/kyc')])"` (cwd: `backend/`)
- EXPECT: exit 0; output lists the five `/v1/kyc*` paths.
- IF FAIL: fix the import/include lines, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.6 — Register KYC modules in conftest and test pipeline
- DO: (1) Edit `backend/tests/conftest.py`: add `"app.routers.kyc"` and `"app.services.kyc"` to BOTH the `get_doc`/`set_doc` tuple and the `query` tuple. (2) Create `backend/tests/test_kyc.py` (new) with tests (seed the caller with `user_store["users/uid-1"] = {"id": "uid-1"}` and an access token via `app.services.tokens.create_access_token("uid-1")` — copy the auth-header pattern from `tests/test_orders.py`):
  1. `test_submit_and_status` — POST `/v1/kyc/cases` with persona `transport` and docs aadhaar/pan/bank_penny_drop/rc/dl → 201; GET `/v1/kyc/status` → 1 case with 5 docs all `pending`.
  2. `test_invalid_doc_type_rejected` — persona `transport` with doc type `fssai` → 422 `INVALID_DOC_TYPE`.
  3. `test_aadhaar_stored_masked` — submit with `extractedRef: "123456789012"` on the aadhaar doc → stored doc's `extractedRef == "XXXXXXXX9012"`; assert the raw string `123456789012` appears NOWHERE in the stored case (global rule 11).
  4. `test_reupload_resets_rejected_doc` — submit a case; manually flip one doc to `rejected` with a reason in `user_store`; POST `/v1/kyc/cases/{case_id}/docs` → that doc is `pending` again, reason cleared, case `pending`.
- RUN: `.venv/bin/python -m pytest -q tests/test_kyc.py` (cwd: `backend/`)
- EXPECT: exit 0, `4 passed`.
- IF FAIL: print the failing response body once, align the test to the implemented contract (tasks 4.2–4.4 are the truth), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.7 — Rewrite admin KYC queue to live data
- DO: Edit `backend/app/routers/admin.py`: (1) in `get_kyc_queue` (~L166) DELETE the hardcoded `queue = [...]` list (both `kyc-01`/`kyc-02` sample docs) and replace the body with:
  ```python
  cases = await query("kyc_cases", [("status", "==", "pending")], limit=100)
  items = [
      {"id": c["caseId"], "userId": c["userId"], "persona": c["persona"], "docs": c["docs"], "submittedAt": c["submittedAt"], "status": c["status"]}
      for c in cases
  ]
  return {"data": items, "total": len(items)}
  ```
  (2) in `get_admin_overview` (~L95) replace `"pendingKycCount": 8,` with `"pendingKycCount": len(await query("kyc_cases", [("status", "==", "pending")], limit=500)),`.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py -k kyc` (cwd: `backend/`)
- EXPECT: exit 0 (tests referencing the old sample docs are updated in task 4.9).
- IF FAIL: confirm no `kyc-01`/`kyc-02`/`pendingKycCount": 8` remains (`grep -n "kyc-01\|kyc-02" app/routers/admin.py` must return nothing), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.8 — Rewrite admin KYC review against kyc_cases
- PRECONDITION: `grep -n "def admin_action" backend/app/core/deps.py` — if this fails, STOP the phase (playbook §5): WS-02 task 2.3 is missing.
- DO: Edit `backend/app/routers/admin.py`: (1) replace the `KycReviewIn` model with:
  ```python
  class KycReviewIn(BaseModel):
      docId: str
      status: str = Field(..., description="verified | rejected")
      reason: Optional[str] = None
  ```
  (2) rewrite `review_kyc_document` as:
  ```python
  @router.post("/kyc/{case_id}/review")
  async def review_kyc_document(
      case_id: str,
      body: KycReviewIn,
      user: dict = Depends(admin_user),
      _audit: dict = Depends(admin_action("REVIEW_KYC_DOC")),
  ):
      if body.status not in ("verified", "rejected"):
          _error(422, "INVALID_STATUS", "status must be verified or rejected")
      if body.status == "rejected" and not (body.reason and body.reason.strip()):
          _error(422, "REASON_REQUIRED", "a reason is mandatory when rejecting a document")
      case = await get_doc("kyc_cases", case_id)
      if case is None:
          _error(404, "CASE_NOT_FOUND", "kyc case not found")
      target = next((d for d in case["docs"] if d["docId"] == body.docId), None)
      if target is None:
          _error(404, "DOC_NOT_FOUND", "no such doc in this case")
      target["status"] = body.status
      target["reason"] = body.reason if body.status == "rejected" else None
      case["reviewedBy"] = user["uid"]
      case["reviewedAt"] = datetime.now(timezone.utc).isoformat()
      if all(d["status"] == "verified" for d in case["docs"]):
          case["status"] = "verified"
      else:
          case["status"] = "pending"
      await set_doc("kyc_cases", case_id, case)
      return {"success": True, "caseId": case_id, "docId": body.docId, "docStatus": body.status, "caseStatus": case["status"]}
  ```
  Note the endpoint path parameter changed from `doc_id` to `case_id` — the audit `targetId` now lands on the case (rule 8: reason + audit_logs entry are enforced by `admin_action`).
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py -k kyc` (cwd: `backend/`)
- EXPECT: command completes; test assertions referencing the OLD request/response shape fail — they are updated in task 4.9; no import/name errors.
- IF FAIL: fix `NameError`s (`get_doc`/`set_doc`/`admin_user`/`admin_action` are already imported from earlier tasks — check), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.9 — Update admin KYC tests to live pipeline
- DO: Edit `backend/tests/test_admin.py`: rewrite the KYC queue/review tests to the new contract — seed `user_store["kyc_cases/kyc_u1_transport"]` with a case containing 2 pending docs; `GET /v1/admin/kyc/queue` with `Bearer admin-token` → the seeded case appears (no `kyc-01`/`kyc-02`); `POST /v1/admin/kyc/kyc_u1_transport/review` with headers `X-Admin-Role: superadmin`, `X-Audit-Reason: test` and body `{"docId": "<doc1>", "status": "rejected"}` WITHOUT reason → 422 `REASON_REQUIRED`; with `"reason": "blurry scan"` → 200, stored doc `rejected` with that reason, case still `pending`; verify the remaining doc → case flips `verified` only when ALL docs are verified; a `Bearer plain-token` call → 403.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: align the seed doc field names with tasks 4.2/4.8 (`caseId`, `docs[].docId`, `status`), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.10 — Add KYC expiry reminder job logic
- DO: Edit `backend/app/services/kyc.py`: append:
  ```python
  from app.services.notifications import send_fcm_to_user


  async def run_kyc_expiry_reminders(now_iso: str | None = None) -> dict:
      """Notify 30 days before a tracked document's expiresAt; instructor
      credentials get a recurring re-verification flag (instructions.md §WS-04 step 4)."""
      now = datetime.fromisoformat((now_iso or _now()).replace("Z", "+00:00"))
      cases = await query(COLLECTION, limit=1000)
      reminded = flagged = 0
      for case in cases:
          changed = False
          for doc in case.get("docs", []):
              if doc.get("type") not in EXPIRY_TRACKED or doc.get("status") == "rejected":
                  continue
              expires = doc.get("expiresAt")
              if not expires:
                  continue
              days_left = (datetime.fromisoformat(expires.replace("Z", "+00:00")) - now).days
              if 0 <= days_left <= 30 and not doc.get("expiryReminderSentAt"):
                  await send_fcm_to_user(
                      case["userId"],
                      "दस्तावेज़ समाप्ति चेतावनी / Document expiring",
                      f"Your {doc['type']} expires in {days_left} days — renew it to stay verified",
                      {"type": "kyc_doc_expiring", "caseId": case["caseId"], "docType": doc["type"]},
                  )
                  doc["expiryReminderSentAt"] = _now()
                  reminded += 1
                  changed = True
              if days_left < 0 and doc.get("type") in RECURRING_REVERIFY and not case.get("needsReverification"):
                  case["needsReverification"] = True
                  doc["status"] = "pending"
                  doc["reason"] = "expired — recurring re-verification required"
                  flagged += 1
                  changed = True
          if changed:
              await save_case(case)
      return {"reminded": reminded, "flagged": flagged}
  ```
- RUN: `.venv/bin/python -c "from app.services.kyc import run_kyc_expiry_reminders; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.11 — Add expiry reminder job endpoint and test
- DO: (1) Edit `backend/app/routers/jobs.py`: add `from app.services.kyc import run_kyc_expiry_reminders` to imports and append:
  ```python
  @router.post("/kyc/expiry-reminders")
  async def kyc_expiry_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
      _check_cron_secret(x_cron_secret)
      return await run_kyc_expiry_reminders()
  ```
  (2) Edit `backend/tests/test_kyc.py`: append `test_expiry_reminder_30_days` — monkeypatch `app.services.kyc.send_fcm_to_user` with an async recorder; seed `user_store["kyc_cases/kyc_u9_transport"]` with a case whose rc doc has `expiresAt` 20 days out and `status: "verified"`; `result = await run_kyc_expiry_reminders()`; assert `result["reminded"] == 1`, the recorder got one call, and the stored doc has `expiryReminderSentAt` set. Append `test_instructor_credential_reverify_flag` — same but `expiresAt` 5 days in the PAST on an `instructor_credential` doc → `result["flagged"] == 1`, case has `needsReverification: True`, doc back to `pending`.
- RUN: `.venv/bin/python -m pytest -q tests/test_kyc.py` (cwd: `backend/`)
- EXPECT: exit 0, `6 passed`.
- IF FAIL: align seed docs to the field names in task 4.10, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.12 — Create website KYC API wrapper
- DO: Create `website/src/lib/api/kyc.ts` (new): read `website/src/lib/api/users.ts` FIRST and mirror its style exactly. Export: `getKycMatrix()` (GET `/kyc/matrix`), `submitKycCase(payload: { persona: string; docs: { type: string; storagePath: string; expiresAt?: string }[] })` (POST `/kyc/cases`), `getKycStatus()` (GET `/kyc/status`), `reuploadKycDoc(caseId: string, payload: { type: string; storagePath: string; expiresAt?: string })` (POST `/kyc/cases/${caseId}/docs`), `uploadKycDoc(file: File)` (POST `/kyc/upload` as multipart FormData via the shared `api` client). Define and export TS types `KycDoc`, `KycCase` matching the backend shapes from task 4.2.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: match the wrapper style/types to `users.ts`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.13 — Build KYC submission wizard view
- DO: Create `website/src/views/kyc/KycWizard.tsx` (new): read `website/src/views/onboarding/ProfileDetails.tsx` FIRST and mirror its layout/form patterns. The wizard: (1) fetches the doc checklist from `getKycMatrix()` for the user's active persona (from the session/onboarding store — use the same source the onboarding views use); (2) renders one step per required doc with an upload control calling `uploadKycDoc` and storing the returned `storagePath`; (3) for the `aadhaar` doc shows the masked-Aadhaar notice `t('kyc.wizard.maskedAadhaarNotice')`; (4) for types in the expiry-tracked set (`rc`, `insurance`, `fitness`, `apmc_licence`, `arhtiya_licence`, `operator_licence`, `instructor_credential`) shows an expiry-date input; (5) final step calls `submitKycCase` then navigates to `/kyc/status`. ALL strings via `t()`; NO `alert()`/`confirm()` (playbook §3 rules 3 + global rule 6).
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: fix imports/types, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.14 — Build KYC status page view
- DO: Create `website/src/views/kyc/KycStatus.tsx` (new): fetch `getKycStatus()` on mount; render each case with per-doc status badges (pending/verified/rejected via `t('kyc.status.state.pending')` etc.); for rejected docs show the `reason` and a re-upload control that calls `uploadKycDoc` + `reuploadKycDoc` then refetches; show `t('kyc.status.verifiedBanner')` when a case is `verified`. All strings via `t()`; no `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: fix imports/types, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.15 — Add KYC i18n keys in English and Hindi
- DO: Edit `website/src/lib/i18n/locales/en.ts` AND `website/src/lib/i18n/locales/hi.ts`: add the SAME key set to both files (English text in en, Hindi in hi — translate every value; no English-only strings, global rule 6):
  `kyc.wizard.title`, `kyc.wizard.subtitle`, `kyc.wizard.upload`, `kyc.wizard.expiresAt`, `kyc.wizard.maskedAadhaarNotice` ("Only the last 4 digits of your Aadhaar are stored"), `kyc.wizard.submit`, `kyc.wizard.success`, `kyc.status.title`, `kyc.status.verifiedBanner`, `kyc.status.rejectedReason`, `kyc.status.reupload`, `kyc.status.state.pending`, `kyc.status.state.verified`, `kyc.status.state.rejected`, and one label per doc type: `kyc.doc.aadhaar`, `kyc.doc.pan`, `kyc.doc.bank_penny_drop`, `kyc.doc.rc`, `kyc.doc.dl`, `kyc.doc.apmc_licence`, `kyc.doc.gst`, `kyc.doc.arhtiya_licence`, `kyc.doc.insurance`, `kyc.doc.operator_licence`, `kyc.doc.fssai`, `kyc.doc.iec`, `kyc.doc.apeda`, `kyc.doc.instructor_credential`, `kyc.doc.land_712`, `kyc.doc.tax_receipt`, `kyc.doc.fitness`.
- RUN: `pnpm exec tsc --noEmit && node -e "const fs=require('fs');const en=fs.readFileSync('src/lib/i18n/locales/en.ts','utf8');const hi=fs.readFileSync('src/lib/i18n/locales/hi.ts','utf8');const keys=['kyc.wizard.title','kyc.status.verifiedBanner','kyc.doc.aadhaar','kyc.doc.land_712','kyc.status.state.rejected'];for(const k of keys){if(!en.includes(k)||!hi.includes(k)){console.error('missing: '+k);process.exit(1)}}console.log('parity ok')"` (cwd: `website/`)
- EXPECT: `tsc` exit 0 and output `parity ok`.
- IF FAIL: add the missing key to whichever locale file lacks it, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.16 — Register KYC routes in the app router
- DO: Edit `website/src/App.tsx`: import `KycWizard` and `KycStatus` (lazy imports matching the file's existing pattern — read it first) and add routes: path `/kyc` → `KycWizard`, path `/kyc/status` → `KycStatus`, placed alongside the existing authenticated routes.
- RUN: `pnpm exec tsc --noEmit && pnpm build` (cwd: `website/`)
- EXPECT: `tsc` exit 0; `pnpm build` succeeds.
- IF FAIL: fix the route registration to match App.tsx's existing route pattern, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.17 — HUMAN CHECK: KYC round-trip in staging
- DO: HUMAN CHECK — with the dev server (`cd backend && .venv/bin/uvicorn app.main:app --port 8000`) and website (`cd website && pnpm dev`) running, the human: (1) logs in as a transporter and submits Aadhaar+PAN+bank+RC/DL via `/kyc`; (2) confirms the case appears in `GET /v1/admin/kyc/queue` (live data, no `kyc-01`); (3) as admin, verifies 4 docs and rejects RC with a reason; (4) opens `/kyc/status` → per-doc states + the reject reason visible; (5) re-uploads RC → case back to pending; (6) verifies RC → case flips `verified`; (7) confirms `/v1/admin/overview` `pendingKycCount` reflects the live count.
- RUN: `curl -s http://localhost:8000/v1/admin/kyc/queue -H "Authorization: Bearer admin-token" | head -c 400` (requires the dev server running; in dev the Firebase admin token must come from a real sign-in — human substitutes it)
- EXPECT: JSON with a `data` array of live cases; the human confirms steps 1–7 including the masked-Aadhaar notice in the wizard.
- IF FAIL: record which numbered step failed and STOP (playbook §5) with full output.
- [ ]

### Task 4.18 — WS-04 checkpoint: verify and commit
- DO: Run the full WS-04 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_admin.py -k kyc && .venv/bin/python -m pytest -q tests/test_kyc.py && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-00 WS-04: KYC pipeline"`
- EXPECT: backend KYC tests pass; `tsc` clean; `pnpm build` succeeds; commit created.
- IF FAIL: fix failures in files WS-04 touched; record pre-existing unrelated failures per the ordering note — else STOP (playbook §5) with full output.
- [ ]

## WS-05 — Subscriptions & billing  (see instructions.md §WS-05)

> Inline rule (global 5): NEVER paywall the farmer's core grow-sell-insure loop —
> `require_entitlement` must short-circuit for persona `farmer`.

### Task 5.1 — Create billing service with tier-matrix plans
- DO: Create `backend/app/services/billing.py` (new) with exactly:
  ```python
  """Billing core: plans + subscriptions + entitlements (instructions.md §WS-05,
  tier matrix from robust.md §10). Prices are integer paisa per month."""
  import logging
  from datetime import datetime, timezone

  from fastapi import Depends, HTTPException

  from app.core.cache import REDIS_ERRORS, cache_get, get_redis
  from app.core.db import get_doc, query, set_doc
  from app.core.deps import current_user_id

  log = logging.getLogger(__name__)

  # Tier matrix (robust.md §10): prices ₹/mo x100; commissionBps is reference
  # data — commission is ALWAYS charged and lives in platform_config/settlements.
  PLANS: list[dict] = [
      {"planId": "farmer_free", "persona": "farmer", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 0, "limits": {}, "features": ["everything core"]},
      {"planId": "landlord_free", "persona": "farmLandlord", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 0, "limits": {"listings": 1}, "features": ["1 plot/1 lease"]},
      {"planId": "landlord_pro", "persona": "farmLandlord", "tier": "pro", "priceMonthlyPaisa": 29900, "commissionBps": 0, "limits": {}, "features": ["unlimited plots/leases"]},
      {"planId": "transporter_free", "persona": "transport", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 1000, "limits": {"vehicles": 1}, "features": ["1 vehicle"]},
      {"planId": "transporter_pro", "persona": "transport", "tier": "pro", "priceMonthlyPaisa": 49900, "commissionBps": 1000, "limits": {}, "features": ["unlimited vehicles"]},
      {"planId": "seller_free", "persona": "seller", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 200, "limits": {}, "features": ["basic khata"]},
      {"planId": "seller_pro", "persona": "seller", "tier": "pro", "priceMonthlyPaisa": 99900, "commissionBps": 200, "limits": {}, "features": ["full khata"]},
      {"planId": "equipment_free", "persona": "equipmentRental", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 1200, "limits": {"machines": 1}, "features": ["1 machine"]},
      {"planId": "equipment_pro", "persona": "equipmentRental", "tier": "pro", "priceMonthlyPaisa": 39900, "commissionBps": 1200, "limits": {}, "features": ["unlimited machines"]},
      {"planId": "broker_free", "persona": "broker", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 200, "limits": {"listings": 5}, "features": ["5 deals"]},
      {"planId": "broker_pro", "persona": "broker", "tier": "pro", "priceMonthlyPaisa": 79900, "commissionBps": 200, "limits": {}, "features": ["unlimited deals"]},
      {"planId": "dairy_free", "persona": "dairyManager", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 300, "limits": {"teamSeats": 25}, "features": ["25 members"]},
      {"planId": "dairy_pro", "persona": "dairyManager", "tier": "pro", "priceMonthlyPaisa": 149900, "commissionBps": 300, "limits": {}, "features": ["unlimited members"]},
      {"planId": "instructor_free", "persona": "instructor", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 1500, "limits": {"listings": 1}, "features": ["1 course"]},
      {"planId": "instructor_pro", "persona": "instructor", "tier": "pro", "priceMonthlyPaisa": 49900, "commissionBps": 1500, "limits": {}, "features": ["unlimited courses"]},
      {"planId": "directbuyer_free", "persona": "directBuyer", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 100, "limits": {"listings": 1}, "features": ["1 contract"]},
      {"planId": "directbuyer_pro", "persona": "directBuyer", "tier": "pro", "priceMonthlyPaisa": 499900, "commissionBps": 100, "limits": {}, "features": ["unlimited contracts"]},
      {"planId": "directbuyer_enterprise", "persona": "directBuyer", "tier": "enterprise", "priceMonthlyPaisa": 2499900, "commissionBps": 100, "limits": {}, "features": ["enterprise settlement"]},
      {"planId": "emarket_free", "persona": "emarketCustomer", "tier": "free", "priceMonthlyPaisa": 0, "commissionBps": 0, "limits": {}, "features": ["full customer experience"]},
      {"planId": "console_pro", "persona": "console", "tier": "pro", "priceMonthlyPaisa": 200000, "commissionBps": 0, "limits": {"teamSeats": 1}, "features": ["console seat — bank/insurance/cold-storage, per seat"]},
  ]

  FREE_PLAN_BY_PERSONA: dict[str, str] = {
      "farmer": "farmer_free",
      "farmLandlord": "landlord_free",
      "transport": "transporter_free",
      "seller": "seller_free",
      "equipmentRental": "equipment_free",
      "broker": "broker_free",
      "dairyManager": "dairy_free",
      "instructor": "instructor_free",
      "directBuyer": "directbuyer_free",
      "emarketCustomer": "emarket_free",
  }


  def _now() -> str:
      return datetime.now(timezone.utc).isoformat()


  async def seed_plans() -> dict:
      for plan in PLANS:
          plan.setdefault("providerPlanId", "")  # operator fills with the Razorpay plan id
          await set_doc("plans", plan["planId"], plan)
      return {"seeded": len(PLANS)}


  async def get_plan(plan_id: str) -> dict | None:
      return await get_doc("plans", plan_id)


  async def get_free_plan(persona: str) -> dict | None:
      return await get_plan(FREE_PLAN_BY_PERSONA.get(persona, "farmer_free"))


  async def get_active_subscription(user_id: str) -> dict | None:
      subs = await query("subscriptions", [("userId", "==", user_id), ("status", "==", "active")], limit=1)
      return subs[0] if subs else None


  async def get_billing_config() -> dict:
      config = await get_doc("platform_config", "billing")
      if config is None:
          # grace period + downgrade rules live here (instructions.md §WS-05 step 3)
          config = {"graceDays": 3, "downgradeToFree": True}
          await set_doc("platform_config", "billing", config)
      return config
  ```
- RUN: `.venv/bin/python -c "from app.services.billing import PLANS, FREE_PLAN_BY_PERSONA; assert len(PLANS) == 20; assert all(p['priceMonthlyPaisa'] == int(p['priceMonthlyPaisa']) for p in PLANS); print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.2 — Create plans seed script
- DO: Create `backend/scripts/seed_plans.py` (new): read `backend/scripts/seed_app_config.py` FIRST and mirror its structure; it must call `asyncio.run(seed_plans())` (import from `app.services.billing`) and print the result.
- RUN: `.venv/bin/python -c "import scripts.seed_plans"` (cwd: `backend/`) — import-only check; do NOT execute against real Firestore here.
- EXPECT: exit 0.
- IF FAIL: fix the import path/style to match `seed_app_config.py`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.3 — Create billing router with read endpoints
- DO: Create `backend/app/routers/billing.py` (new) with exactly:
  ```python
  from fastapi import APIRouter, Depends, HTTPException
  from fastapi.responses import FileResponse

  from app.core.db import get_doc, query
  from app.core.deps import current_user_id
  from app.services.billing import get_active_subscription, get_free_plan

  router = APIRouter(prefix="/billing", tags=["billing"])


  def _error(status_code: int, code: str, message: str):
      raise HTTPException(status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}})


  @router.get("/plans")
  async def list_plans():
      plans = await query("plans", limit=100)
      return {"plans": sorted(plans, key=lambda p: (p["persona"], p["priceMonthlyPaisa"]))}


  @router.get("/subscription")
  async def my_subscription(uid: str = Depends(current_user_id)):
      sub = await get_active_subscription(uid)
      return {"subscription": sub}


  @router.get("/invoices")
  async def my_invoices(uid: str = Depends(current_user_id)):
      invoices = await query("invoices", [("businessId", "==", uid)], limit=100)
      return {"invoices": invoices}


  @router.get("/invoices/{invoice_id}/pdf")
  async def invoice_pdf(invoice_id: str, uid: str = Depends(current_user_id)):
      invoice = await get_doc("invoices", invoice_id)
      if invoice is None or invoice.get("businessId") != uid:
          _error(404, "INVOICE_NOT_FOUND", "invoice not found")
      pdf_path = invoice.get("pdfPath")
      if not pdf_path:
          _error(404, "INVOICE_PDF_MISSING", "invoice pdf not generated")
      return FileResponse(pdf_path, media_type="application/pdf", filename=f"{invoice_id}.pdf")
  ```
- RUN: `.venv/bin/python -c "from app.routers.billing import router; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.4 — Add subscribe endpoint (Subscriptions / UPI Autopay)
- DO: Edit `backend/app/routers/billing.py`: (1) add imports `import httpx`, `from pydantic import BaseModel, Field`, `from app.core.config import settings`, `from app.core.db import set_doc`, `from app.services.billing import get_plan`, `from datetime import datetime, timezone`; (2) append:
  ```python
  class SubscribeIn(BaseModel):
      planId: str = Field(..., min_length=1)
      provider: str = Field(..., description="razorpay_sub | upi_autopay")


  @router.post("/subscribe", status_code=201)
  async def subscribe(body: SubscribeIn, uid: str = Depends(current_user_id)):
      if body.provider not in ("razorpay_sub", "upi_autopay"):
          _error(422, "INVALID_PROVIDER", "provider must be razorpay_sub or upi_autopay")
      plan = await get_plan(body.planId)
      if plan is None:
          _error(404, "PLAN_NOT_FOUND", "unknown plan")
      if plan["priceMonthlyPaisa"] == 0:
          _error(422, "FREE_PLAN", "free plans need no subscription")
      if not (settings.razorpay_key_id and settings.razorpay_key_secret):
          _error(503, "PAYMENTS_NOT_CONFIGURED", "payments are not configured")
      # UPI Autopay mandates are created through the same Razorpay Subscriptions
      # API with method=upi (critical for rural India — instructions.md §WS-05 step 3)
      payload = {
          "plan_id": plan.get("providerPlanId") or body.planId,
          "total_count": 120,
          "customer_notify": 1,
      }
      if body.provider == "upi_autopay":
          payload["method"] = "upi"
      async with httpx.AsyncClient() as client:
          resp = await client.post(
              "https://api.razorpay.com/v1/subscriptions",
              auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
              json=payload,
              timeout=20.0,
          )
      data = resp.json()
      provider_ref = data.get("id", "")
      await set_doc(
          "billing_intents",
          provider_ref,
          {"userId": uid, "planId": body.planId, "provider": body.provider, "providerRef": provider_ref, "createdAt": datetime.now(timezone.utc).isoformat()},
      )
      return {"provider": body.provider, "providerRef": provider_ref, "checkoutPayload": data}
  ```
  The `subscriptions` doc itself is written ONLY by the webhook (task 5.5) — status is webhook-driven per instructions.md §WS-05 step 3.
- RUN: `.venv/bin/python -c "from app.routers.billing import router; print([r.path for r in router.routes])"` (cwd: `backend/`)
- EXPECT: exit 0; output contains `/billing/plans`, `/billing/subscription`, `/billing/invoices`, `/billing/invoices/{invoice_id}/pdf`, `/billing/subscribe`.
- IF FAIL: fix the appended code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.5 — Extend webhook for subscription events
- DO: Edit `backend/app/routers/payments.py` in `razorpay_webhook`: after the `set_doc("payment_events", ...)` write and before `return {"ok": True}`, add:
  ```python
  event_type = event.get("event") or ""
  if event_type.startswith("subscription."):
      entity = (event.get("payload") or {}).get("subscription", {}).get("entity", {})
      provider_ref = entity.get("id")
      if provider_ref:
          intent = await get_doc("billing_intents", provider_ref) or {}
          status_map = {"subscription.activated": "active", "subscription.charged": "active", "subscription.halted": "past_due", "subscription.cancelled": "cancelled"}
          new_status = status_map.get(event_type)
          if new_status:
              await set_doc(
                  "subscriptions",
                  f"sub_{intent.get('userId', 'unknown')}",
                  {
                      "subId": f"sub_{intent.get('userId', 'unknown')}",
                      "userId": intent.get("userId"),
                      "planId": intent.get("planId"),
                      "status": new_status,
                      "provider": intent.get("provider", "razorpay_sub"),
                      "providerRef": provider_ref,
                      "currentPeriodEnd": datetime.fromtimestamp(entity["current_end"], tz=timezone.utc).isoformat() if entity.get("current_end") else None,
                  },
              )
  ```
  (Add `from datetime import datetime, timezone` to the file's imports if not already present.)
- RUN: `.venv/bin/python -m pytest -q tests/test_payments.py` (cwd: `backend/`)
- EXPECT: exit 0, all 5 pass (non-subscription events are unaffected).
- IF FAIL: fix the inserted block's indentation/placement, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.6 — Register billing router and conftest modules
- DO: (1) Edit `backend/app/main.py`: add `billing,` to the routers import list (alphabetical, after `bank_accounts,`) and `app.include_router(billing.router, prefix="/v1")`. (2) Edit `backend/tests/conftest.py`: add `"app.routers.billing"` and `"app.services.billing"` to BOTH the `get_doc`/`set_doc` tuple and the `query` tuple.
- RUN: `.venv/bin/python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/v1/billing')])" && .venv/bin/python -m pytest -q tests/test_infra.py` (cwd: `backend/`)
- EXPECT: exit 0; the five `/v1/billing*` paths printed; infra tests pass.
- IF FAIL: fix the registration, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.7 — Add require_entitlement dependency and usage counters
- DO: Edit `backend/app/services/billing.py`: append:
  ```python
  def require_entitlement(limit_key: str):
      """FastAPI dependency enforcing plan limits with per-billing-period usage
      counters (Redis; key usage:<uid>:<yyyymm>:<limit_key>). Global rule 5:
      the farmer's core loop is NEVER paywalled."""
      async def dep(uid: str = Depends(current_user_id)) -> dict:
          user = await get_doc("users", uid) or {}
          persona = user.get("activeProfile", "")
          if persona == "farmer":
              return {"planId": "farmer_free", "limit": None}
          sub = await get_active_subscription(uid)
          plan = await get_plan(sub["planId"]) if sub else await get_free_plan(persona)
          if plan is None:
              return {"planId": None, "limit": None}
          limit = (plan.get("limits") or {}).get(limit_key)
          if limit is None:
              return {"planId": plan["planId"], "limit": None}
          period = datetime.now(timezone.utc).strftime("%Y%m")
          used = int(await cache_get(f"usage:{uid}:{period}:{limit_key}") or 0)
          if used >= int(limit):
              raise HTTPException(
                  status_code=402,
                  detail={"code": "ENTITLEMENT_EXCEEDED", "message": "plan limit reached — upgrade to continue", "fieldErrors": {}, "limit": int(limit), "used": used, "planId": plan["planId"]},
              )
          return {"planId": plan["planId"], "limit": int(limit)}
      return dep


  async def increment_usage(uid: str, limit_key: str) -> None:
      period = datetime.now(timezone.utc).strftime("%Y%m")
      key = f"usage:{uid}:{period}:{limit_key}"
      try:
          r = await get_redis()
          n = await r.incr(key)
          if n == 1:
              await r.expire(key, 40 * 86400)
      except REDIS_ERRORS as exc:
          log.warning("usage counter unavailable (%s): %s", key, exc)
  ```
- RUN: `.venv/bin/python -c "from app.services.billing import require_entitlement, increment_usage; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports (`Depends` from fastapi), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.8 — Enforce vehicle limit in transport router
- DO: Edit `backend/app/routers/transport.py`: (1) add `from app.services.billing import increment_usage, require_entitlement` to imports; (2) in the `POST /vehicles` handler (~L226) add dependency `_ent: dict = Depends(require_entitlement("vehicles"))` to the signature; (3) after the vehicle doc is successfully written, add `await increment_usage(uid, "vehicles")` using the handler's actual user-id variable name (read the handler first).
- RUN: `.venv/bin/python -m pytest -q tests/test_transport.py tests/test_tms.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (seeded test users without a profile default to no limit).
- IF FAIL: if a test user hits the free 1-vehicle limit, seed that test's user with an active subscription or a plan without the limit (see task 5.11 patterns) — never delete the assertion — else STOP (playbook §5) with full output.
- [ ]

### Task 5.9 — Enforce machine limit in equipment owner router
- DO: Edit `backend/app/routers/equipment_owner.py`: same pattern as task 5.8 — `Depends(require_entitlement("machines"))` on the machine-create handler (`POST ""`, ~L84) and `await increment_usage(uid, "machines")` after the successful write.
- RUN: `.venv/bin/python -m pytest -q tests/test_equipment_owner.py tests/test_saas_equipment_owner.py tests/test_equipment_approve.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: same approach as task 5.8 — else STOP (playbook §5) with full output.
- [ ]

### Task 5.10 — Enforce listing limit in broker router
- DO: Edit `backend/app/routers/broker.py`: same pattern as task 5.8 — `Depends(require_entitlement("listings"))` on the lead-create handler (`POST /leads`, ~L289) and `await increment_usage(uid, "listings")` after the successful write.
- RUN: `.venv/bin/python -m pytest -q tests/test_broker_deals.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: same approach as task 5.8 — else STOP (playbook §5) with full output.
- [ ]

### Task 5.11 — Create billing entitlement tests
- DO: Create `backend/tests/test_billing.py` (new) with:
  1. `test_free_transporter_blocked_over_limit` — seed `user_store["users/uid-1"] = {"id": "uid-1", "activeProfile": "transport"}` and `user_store["plans/transporter_free"] = <the transporter_free plan dict from services/billing.py PLANS>`; monkeypatch `app.services.billing.cache_get` with an async function returning `"1"`; POST `/v1/transport/vehicles` with a valid vehicle body (copy the body from an existing `tests/test_transport.py` vehicle-create test) and an access token for `uid-1` → 402; assert the envelope code is `ENTITLEMENT_EXCEEDED` and the detail carries `limit == 1`, `used == 1`, `planId == "transporter_free"`.
  2. `test_pro_subscription_passes` — same but ALSO seed `user_store["subscriptions/sub_uid-1"] = {"subId": "sub_uid-1", "userId": "uid-1", "planId": "transporter_pro", "status": "active"}` and `user_store["plans/transporter_pro"] = <transporter_pro dict>` → NOT 402 (vehicle created).
  3. `test_farmer_never_paywalled` — seed user with `activeProfile: "farmer"`, monkeypatch `cache_get` returning `"999"`; call the dependency `require_entitlement("listings")` directly (resolve `dep = require_entitlement("listings")` then `await dep("uid-farmer")`) → returns without raising.
  4. `test_usage_counter_increments` — monkeypatch `app.services.billing.get_redis` to return the `fake_redis` fixture; `await increment_usage("uid-1", "vehicles")` twice; assert `await fake_redis.get(...)` equals `"2"` for the current `%Y%m` key.
- RUN: `.venv/bin/python -m pytest -q -k billing` (cwd: `backend/`)
- EXPECT: exit 0, the 4 new tests pass.
- IF FAIL: print the 402/500 body once, align seeds to the implemented contract (tasks 5.1/5.7 are the truth), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.12 — Create website billing API wrapper and paywall prompt
- DO: (1) Create `website/src/lib/api/billing.ts` (new): mirror `website/src/lib/api/users.ts` style; export `getPlans()`, `getSubscription()`, `subscribe(planId: string, provider: 'razorpay_sub' | 'upi_autopay')`, `getInvoices()`, `invoicePdfUrl(invoiceId: string)` (returns `/billing/invoices/${invoiceId}/pdf`), plus `isEntitlementError(e: unknown)` (true when `isApiError(e) && e.code === 'ENTITLEMENT_EXCEEDED'`) and type `EntitlementDetails { limit: number; used: number; planId: string }`. (2) Edit `website/src/lib/api/client.ts`: extend `ApiError` with an optional `details?: Record<string, unknown>` populated from the error body fields `limit`/`used`/`planId` when present (read the envelope construction in `client.ts` and add the fields without changing existing behavior). (3) Create `website/src/views/billing/PaywallPrompt.tsx` (new): a panel that takes an `ApiError` with entitlement details and renders `t('billing.paywall.title')`, the usage line `t('billing.paywall.usage', { used, limit })`, and a link/button to `/billing/plans` with `t('billing.paywall.upgrade')`. No `alert()`.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: match the existing wrapper/component patterns, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.13 — Build plan comparison page
- DO: Create `website/src/views/billing/Plans.tsx` (new): fetch `getPlans()` on mount; group by persona; render each plan as a card showing `t('billing.plans.tier.' + plan.tier)`, the monthly price formatted from paisa (`(priceMonthlyPaisa / 100).toLocaleString('en-IN')` — display formatting only, money stays paisa in state), the limits list, and a subscribe button on paid plans calling `subscribe(plan.planId, 'razorpay_sub')` then surfacing the provider checkout payload (in test mode show the returned `short_url`/id; no real payment in this view); free plans show `t('billing.plans.current')` when they match the user's effective plan from `getSubscription()`.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: fix types against `billing.ts`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.14 — Build invoices list with GST download
- DO: Create `website/src/views/billing/Invoices.tsx` (new): fetch `getInvoices()`; render a table (invoice id, kind, period, taxable/GST/total formatted from paisa) with a download button per row pointing at `invoicePdfUrl(invoice.invoiceId)` (plain `<a download>` — the backend route requires the Authorization header, so fetch the blob via the shared `api` client with `responseType: 'blob'` and trigger an object-URL download, mirroring any existing download pattern in the codebase — check `grep -rn "blob" website/src/lib website/src/views | head` first and reuse it).
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: reuse the found blob-download pattern, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.15 — Show subscription status and add billing i18n
- DO: (1) Create `website/src/views/billing/SubscriptionStatus.tsx` (new): fetches `getSubscription()`; renders current plan id + status + `currentPeriodEnd` via `t()` keys, or `t('billing.status.free')` when null. (2) Edit `website/src/App.tsx`: find the route whose path contains `profile`; render `<SubscriptionStatus />` inside that view (edit the profile view file the route points to). If NO profile route exists, render `<SubscriptionStatus />` at the top of `Plans.tsx` instead. (3) Add routes `/billing/plans` → `Plans`, `/billing/invoices` → `Invoices` in `App.tsx` matching its existing lazy-route pattern. (4) Edit `website/src/lib/i18n/locales/en.ts` AND `website/src/lib/i18n/locales/hi.ts`: add the same keys in both (Hindi translations in hi): `billing.paywall.title`, `billing.paywall.usage`, `billing.paywall.upgrade`, `billing.plans.title`, `billing.plans.tier.free`, `billing.plans.tier.pro`, `billing.plans.tier.enterprise`, `billing.plans.subscribe`, `billing.plans.current`, `billing.invoices.title`, `billing.invoices.download`, `billing.status.title`, `billing.status.free`, `billing.status.active`, `billing.status.past_due`, `billing.status.cancelled`, `billing.status.until`.
- RUN: `pnpm exec tsc --noEmit && node -e "const fs=require('fs');const en=fs.readFileSync('src/lib/i18n/locales/en.ts','utf8');const hi=fs.readFileSync('src/lib/i18n/locales/hi.ts','utf8');const keys=['billing.paywall.title','billing.plans.tier.pro','billing.status.past_due','billing.invoices.download'];for(const k of keys){if(!en.includes(k)||!hi.includes(k)){console.error('missing: '+k);process.exit(1)}}console.log('parity ok')"` (cwd: `website/`)
- EXPECT: `tsc` exit 0 and output `parity ok`.
- IF FAIL: add the missing key(s) to the locale file that lacks them, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.16 — HUMAN CHECK: paywall upgrade flow in test mode
- DO: HUMAN CHECK — with dev server + website running and plans seeded (`cd backend && .venv/bin/python scripts/seed_plans.py` against the dev Firestore), the human: (1) as a free transporter, adds vehicles until the 2nd vehicle is blocked → the 402 `ENTITLEMENT_EXCEEDED` envelope payload is visible (dev tools) and the PaywallPrompt renders; (2) subscribes to `transporter_pro` in Razorpay TEST mode; (3) replays/triggers the `subscription.activated` webhook → `GET /v1/billing/subscription` shows `active`; (4) retries adding the vehicle → succeeds; (5) downloads a GST invoice PDF from `/billing/invoices`; (6) confirms a farmer account never sees an entitlement block.
- RUN: `curl -s http://localhost:8000/v1/billing/plans | head -c 300` (requires the dev server running)
- EXPECT: JSON containing a `plans` array with `transporter_pro`; the human confirms steps 1–6.
- IF FAIL: record which numbered step failed and STOP (playbook §5) with full output.
- [ ]

### Task 5.17 — WS-05 checkpoint: verify and commit
- DO: Run the full WS-05 Verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q -k billing && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-00 WS-05: subscriptions & billing"`
- EXPECT: `-k billing` tests pass; `tsc` clean; `pnpm build` succeeds; commit created.
- IF FAIL: fix failures in files WS-05 touched; record pre-existing unrelated failures per the ordering note — else STOP (playbook §5) with full output.
- [ ]

## WS-06 — Platform plumbing  (see instructions.md §WS-06)

> Global rule 9: the backend suite must be fully green at the end of this
> workstream. Repair sweeps (tasks 6.4–6.9) follow one fixed protocol — the
> test is the truth; fix the code, never the assertion (playbook §3 rule 2).

### Task 6.1 — Enumerate the failing-test baseline
- DO: Run the full backend suite and record the complete list of failing test ids plus the summary counts — paste them into your session report (they are the WS-06 repair queue; robust §3.6 counts 45).
- RUN: `.venv/bin/python -m pytest -q 2>&1 | tail -30` (cwd: `backend/`)
- EXPECT: the command completes and the output ends with a summary line like `N failed, M passed`; you have recorded every `FAILED tests/...` line. A non-zero exit code is EXPECTED here — this task fails only if the suite cannot even collect (output contains `ERROR` at collection).
- IF FAIL: fix the collection error first (it blocks everything), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.2 — Refactor conftest to module auto-discovery
- DO: Edit `backend/tests/conftest.py`: (1) add `import importlib`, `import pkgutil`, `import app.data`, `import app.routers`, `import app.services` to the top imports; (2) inside the `client` fixture, REPLACE the three manual module tuples (the `get_doc`/`set_doc` tuple ~L48–110, the `query` tuple ~L147–212, and the per-module one-off `monkeypatch.setattr("app.<module>.<fn>", ...)` lines that duplicate those same fakes) with:
  ```python
  def _app_modules():
      seen = set()
      for package in (app.routers, app.services, app.data):
          for info in pkgutil.walk_packages(package.__path__, prefix=f"{package.__name__}."):
              if info.name in seen:
                  continue
              seen.add(info.name)
              try:
                  yield importlib.import_module(info.name)
              except Exception:
                  continue

  for module in _app_modules():
      for attr, fake in (
          ("get_doc", fake_get_doc),
          ("set_doc", fake_set_doc),
          ("query", fake_query),
          ("delete_doc", fake_delete_doc),
      ):
          if attr in vars(module):
              monkeypatch.setattr(module, attr, fake)
  monkeypatch.setattr("app.core.db.get_doc", fake_get_doc)
  monkeypatch.setattr("app.core.db.set_doc", fake_set_doc)
  monkeypatch.setattr("app.core.db.query", fake_query)
  monkeypatch.setattr("app.core.db.delete_doc", fake_delete_doc)
  ```
  (3) KEEP these special-case lines after the loop, unchanged: the `app.routers.marketplace.db_query` patch, the `app.routers.content.get_redis` patch, the `firebase_auth.verify_id_token` patch, and the httpx transport/client yield at the end. `vars(module)` finds names each module imported into its own namespace — new routers/services need ZERO conftest edits from now on.
- RUN: `.venv/bin/python -m pytest -q 2>&1 | tail -5` (cwd: `backend/`)
- EXPECT: the suite collects and runs to completion (no collection ERRORs); the failed/passed counts are recorded — failures remaining are the repair-sweep queue.
- IF FAIL: if a module fails to import under walk_packages, the `except Exception: continue` skip covers it — confirm the skip is present and the fixture body has no leftover references to the deleted tuples (`grep -n "for module in (" tests/conftest.py` returns nothing), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.3 — Prove new modules need zero conftest edits
- DO: No file change — run the smoke check: the WS-03/04/05 test files exercise routers and services that were never hand-listed in conftest; after task 6.2 they must pass purely via auto-discovery.
- RUN: `.venv/bin/python -m pytest -q tests/test_payments.py tests/test_kyc.py tests/test_billing.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass — without any conftest edit since task 6.2.
- IF FAIL: the failing module is not reached by walk_packages (e.g. a subpackage like `app.services.bank_verify` — those are covered) — inspect which fake is missing in the failing test and fix the auto-discovery loop, NOT the per-module lists — else STOP (playbook §5) with full output.
- [ ]

### Task 6.4 — Repair sweep 1: first failing test file
- DO: Run the full suite, take the alphabetically FIRST test file with any failure, and fix every failure in that file by changing APPLICATION code (never the test, never the assertion — playbook §3 rule 2). Work one failure at a time; re-run that file after each fix.
- RUN: `.venv/bin/python -m pytest -q <the failing file>` (cwd: `backend/`)
- EXPECT: exit 0 — that file fully passes.
- IF FAIL: read the assertion and the code path it exercises; the test encodes the intended behavior — fix the code to satisfy it — else STOP (playbook §5) with full output.
- [ ]

### Task 6.5 — Repair sweep 2: next failing test file
- DO: Same protocol as task 6.4 for the next alphabetically-first test file that still has failures.
- RUN: `.venv/bin/python -m pytest -q <the failing file>` (cwd: `backend/`)
- EXPECT: exit 0 — that file fully passes.
- IF FAIL: same as task 6.4 — else STOP (playbook §5) with full output.
- [ ]

### Task 6.6 — Repair sweep 3: next failing test file
- DO: Same protocol as task 6.4 for the next failing test file.
- RUN: `.venv/bin/python -m pytest -q <the failing file>` (cwd: `backend/`)
- EXPECT: exit 0 — that file fully passes.
- IF FAIL: same as task 6.4 — else STOP (playbook §5) with full output.
- [ ]

### Task 6.7 — Repair sweep 4: next failing test file
- DO: Same protocol as task 6.4 for the next failing test file.
- RUN: `.venv/bin/python -m pytest -q <the failing file>` (cwd: `backend/`)
- EXPECT: exit 0 — that file fully passes.
- IF FAIL: same as task 6.4 — else STOP (playbook §5) with full output.
- [ ]

### Task 6.8 — Repair sweep 5: next failing test file
- DO: Same protocol as task 6.4 for the next failing test file.
- RUN: `.venv/bin/python -m pytest -q <the failing file>` (cwd: `backend/`)
- EXPECT: exit 0 — that file fully passes.
- IF FAIL: same as task 6.4 — else STOP (playbook §5) with full output.
- [ ]

### Task 6.9 — Repair sweep 6: confirm remaining failure count
- DO: Same protocol as task 6.4 for the next failing test file; afterwards run the FULL suite and record how many failures remain (the baseline said ~45 across files; sweeps 1–6 cleared the first six files).
- RUN: `.venv/bin/python -m pytest -q 2>&1 | tail -3` (cwd: `backend/`)
- EXPECT: output ends with a summary whose failed count is LOWER than the task-6.1 baseline (record both numbers). If it is already `0 failed`, note it — the checkpoint (task 6.24) enforces green.
- IF FAIL: if the count did not drop, you re-fixed an already-fixed file — re-enumerate the failing files and continue with the correct next one — else STOP (playbook §5) with full output.
- [ ]

### Task 6.10 — Verify global error-envelope handlers
- DO: Edit `backend/app/main.py`: the `StarletteHTTPException` and `RequestValidationError` handlers already exist (near the end of the file) — verify they match the standard envelope `{"error":{code, message, fieldErrors}}` and add ONLY the missing catch-all, directly after them:
  ```python
  @app.exception_handler(Exception)
  async def unhandled_exception_handler(request: Request, exc: Exception):
      return JSONResponse(
          status_code=500,
          content={"error": {"code": "INTERNAL", "message": "internal server error", "fieldErrors": {}}},
      )
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_infra.py && grep -n "exception_handler" app/main.py` (cwd: `backend/`)
- EXPECT: tests pass; grep shows handlers for `StarletteHTTPException`, `RequestValidationError`, and `Exception`.
- IF FAIL: place the new handler after the existing two (registration order matters), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.11 — Sweep plain-string HTTPException details
- DO: Find every `HTTPException` raised with a plain-string `detail` (these leak the non-envelope shape): convert each to the dict form `detail={"code": "<SCREAMING_CODE>", "message": "<original string>", "fieldErrors": {}}`. Read each site to pick a code that matches its meaning (e.g. `detail="not found"` → `NOT_FOUND`).
- RUN: `grep -rn 'detail="' backend/app --include="*.py" | grep -v "detail={" | grep -v tests` (cwd: repo root)
- EXPECT: exit 1 (grep finds nothing) — every remaining raise uses the dict envelope detail.
- IF FAIL: convert the listed site, re-run the grep — else STOP (playbook §5) with full output.
- [ ]

### Task 6.12 — Add cursor pagination to core db
- DO: Edit `backend/app/core/db.py`: append (Firestore cursors via `start_after`, standard shape `{items, nextCursor}` — instructions.md §WS-06 step 2):
  ```python
  async def query_page(
      collection: str,
      filters: list[tuple[str, str, Any]] | None = None,
      order_field: str = "createdAt",
      limit: int = 50,
      cursor: str | None = None,
  ) -> dict:
      """Cursor-paginated query. `cursor` is the last seen order_field value.
      Returns {"items": [...], "nextCursor": str | None}."""
      q = get_db().collection(collection)
      if filters:
          for field, op, value in filters:
              q = q.where(field, op, value)
      q = q.order_by(order_field)
      if cursor is not None:
          q = q.start_after({order_field: cursor})
      docs = [doc.to_dict() async for doc in q.limit(limit + 1).stream()]
      items = docs[:limit]
      next_cursor = str(items[-1].get(order_field)) if len(docs) > limit and items else None
      return {"items": items, "nextCursor": next_cursor}
  ```
- RUN: `.venv/bin/python -c "from app.core.db import query_page; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix imports (`Any` is already imported in db.py), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.13 — Paginate the admin users endpoint
- DO: Edit `backend/app/routers/admin.py` in `list_users` (~L104): (1) add `from app.core.db import query_page` to imports; (2) replace the `query("users", limit=500)` + Python-slice pagination with `query_page("users", filters, order_field="id", limit=pageSize, cursor=cursor)` — change the signature's `page: int = Query(1, ...)` to `cursor: Optional[str] = Query(None)` (keep `persona`/`status` as Firestore filters in the `filters` list; keep `search` as a post-filter on the returned page) and return `{"items": result["items"], "nextCursor": result["nextCursor"], "pageSize": pageSize}`.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: exit 0 — update any test asserting the old `{"data", "page", "total"}` shape to the new `{items, nextCursor}` shape (the shape change IS the spec — instructions.md §WS-06 step 2).
- IF FAIL: align the endpoint and its tests to the new shape, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.14 — Cap unbounded scans in admin and analytics
- DO: Edit `backend/app/routers/admin.py` AND `backend/app/routers/analytics.py`: every `query(...)` call currently using `limit=1000`/`limit=500` for AGGREGATION (e.g. the `get_admin_overview` users/orders/claims/settlements scans and analytics' equivalents — read both files first) must be capped to a documented page size: add a module-level `MAX_SCAN = 500` in each file and use it, and for the overview's GMV/counts compute from the capped page only. (Full cursor-based aggregation is a phase-08 performance item — this task caps the blast radius per instructions.md §WS-06 step 2.)
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py tests/test_analytics.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the failing aggregation to match the capped data, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.15 — Add composite indexes for new collections
- DO: Edit `infra/firestore.indexes.json`: read the existing file structure first, then append one composite-index entry per NEW phase-00 query (same JSON shape as existing entries): `kyc_cases` (status ASC, submittedAt DESC), `payment_events` (type ASC, receivedAt DESC), `subscriptions` (userId ASC, status ASC), `tds_ledger` (period ASC, persona ASC), `invoices` (businessId ASC, period ASC), `ai_decisions` (module ASC, createdAt DESC), `disputes` (purchaseId ASC, status ASC), `plans` (persona ASC, priceMonthlyPaisa ASC).
- RUN: `python3 -c "import json; d=json.load(open('infra/firestore.indexes.json')); idxs=d.get('indexes', []); cols={i['collectionGroup'] for i in idxs}; required={'kyc_cases','payment_events','subscriptions','tds_ledger','invoices','ai_decisions','disputes','plans'}; missing=required-cols; assert not missing, f'missing indexes: {missing}'; print('indexes ok:', len(idxs))"` (cwd: repo root)
- EXPECT: exit 0, output starts `indexes ok:`.
- IF FAIL: add the missing collection entry in the file's existing entry shape, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.16 — HUMAN CHECK: deploy indexes cleanly
- DO: HUMAN CHECK — the human runs `firebase deploy --only firestore:indexes --project agrovercity-dev` (or the staging project) from the repo root with their Firebase credentials and confirms the deploy completes without index errors.
- RUN: `firebase firestore:indexes --project agrovercity-dev 2>/dev/null | head -5 || echo "firebase CLI unavailable — human must run the deploy"`
- EXPECT: the human confirms the index deploy succeeded (or that the listed indexes match `infra/firestore.indexes.json`).
- IF FAIL: record the deploy error verbatim and STOP (playbook §5) with full output.
- [ ]

### Task 6.17 — Verify backend Sentry wiring
- DO: No file change expected — verify `backend/app/main.py` initialises `sentry_sdk` with the `FastApiIntegration` and `environment=settings.env` when `settings.sentry_dsn` is set (it already does — this is the acceptance check). If the init is missing, add exactly the block from instructions.md §WS-06 step 5.
- RUN: `grep -n "sentry_sdk.init" -A4 backend/app/main.py` (cwd: repo root)
- EXPECT: exit 0; output shows `sentry_sdk.init(` with `FastApiIntegration()` and `environment=settings.env`.
- IF FAIL: add the init block, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.18 — Add website Sentry
- DO: (1) `pnpm add @sentry/react` (cwd: `website/`). (2) Edit `website/src/main.tsx`: read it first, then add BEFORE `createRoot(...)` renders:
  ```ts
  import * as Sentry from '@sentry/react';

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE, tracesSampleRate: 0.2 });
  }
  ```
  (3) Edit `website/.env.example`: append `VITE_SENTRY_DSN=` with comment `# Website Sentry DSN; leave empty in dev.`
- RUN: `pnpm exec tsc --noEmit && pnpm build` (cwd: `website/`)
- EXPECT: `tsc` exit 0; build succeeds with `@sentry/react` bundled.
- IF FAIL: fix the import/init placement, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.19 — Add structured request-logging middleware
- DO: Edit `backend/app/main.py`: (1) add imports `import logging`, `import time`, `import uuid`; (2) add directly after the App Check middleware from task 1.18:
  ```python
  log = logging.getLogger("agrovercity.requests")


  @app.middleware("http")
  async def request_logging_middleware(request: Request, call_next):
      request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
      started = time.monotonic()
      response = await call_next(request)
      latency_ms = int((time.monotonic() - started) * 1000)
      log.info(
          "request",
          extra={"request_id": request_id, "method": request.method, "path": request.url.path, "status": response.status_code, "latency_ms": latency_ms, "user": request.headers.get("X-User-Id", "-")},
      )
      response.headers["X-Request-Id"] = request_id
      return response
  ```
- RUN: `.venv/bin/python -m pytest -q tests/test_infra.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix middleware placement/imports, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.20 — Add staging/prod env files and document all keys
- DO: (1) Create `backend/.env.staging.example` (new) and `backend/.env.production.example` (new): copies of `backend/.env.example` with `ENV=staging` / `ENV=prod` respectively and every secret value left EMPTY with the comment `# real values come from GCP Secret Manager — never commit`. (2) Edit `backend/.env.example`: ensure EVERY `Settings` field in `backend/app/core/config.py` has a documented key (add any missing: `FIREBASE_SERVICE_ACCOUNT_PATH`, `CRON_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SENTRY_DSN`, and the WS-01/03/05/07 additions through the phase — the check below is the truth).
- RUN: `.venv/bin/python -c "from app.core.config import Settings; import re; env=open('.env.example').read(); missing=[f.upper() for f in Settings.model_fields if f.upper() not in env and f not in ('env',)]; assert not missing, f'undocumented: {missing}'; print('all documented')"` (cwd: `backend/`)
- EXPECT: exit 0, output `all documented`.
- IF FAIL: add the named missing key(s) to `.env.example`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.21 — Create locale-parity check script
- DO: Create `website/tool/check-locale-parity.mjs` (new) with exactly:
  ```js
  #!/usr/bin/env node
  // en/hi key-parity gate (global rule 6): every en.* locale module must have
  // the identical key set in its hi.* counterpart. Exit 1 on any mismatch.
  import fs from 'node:fs';
  import path from 'node:path';

  const localesDir = path.resolve('src/lib/i18n/locales');
  const keyRe = /^\s*(?:['"]?)([a-zA-Z0-9_.-]+)(?:['"]?)\s*:/gm;

  function keysOf(file) {
    const text = fs.readFileSync(file, 'utf8');
    const keys = new Set();
    for (const match of text.matchAll(keyRe)) keys.add(match[1]);
    return keys;
  }

  let failed = false;
  for (const file of fs.readdirSync(localesDir)) {
    if (!file.startsWith('en') || !file.endsWith('.ts')) continue;
    const hiFile = file.replace(/^en/, 'hi');
    const hiPath = path.join(localesDir, hiFile);
    if (!fs.existsSync(hiPath)) {
      console.error(`missing locale file: ${hiFile}`);
      failed = true;
      continue;
    }
    const enKeys = keysOf(path.join(localesDir, file));
    const hiKeys = keysOf(hiPath);
    const onlyEn = [...enKeys].filter((k) => !hiKeys.has(k));
    const onlyHi = [...hiKeys].filter((k) => !enKeys.has(k));
    if (onlyEn.length || onlyHi.length) {
      console.error(`${file} <-> ${hiFile}: en-only=[${onlyEn.join(',')}] hi-only=[${onlyHi.join(',')}]`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log('locale parity ok');
  ```
  Also edit `website/package.json`: add to `scripts`: `"check:locales": "node tool/check-locale-parity.mjs"`.
- RUN: `node tool/check-locale-parity.mjs` (cwd: `website/`)
- EXPECT: exit 0, output `locale parity ok`.
- IF FAIL: the output lists the exact missing keys — add them to the locale file that lacks them (real Hindi translations in hi files; never English placeholders), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.22 — Create CI pipeline
- DO: Create `.github/workflows/ci.yml` (new) with exactly:
  ```yaml
  name: ci
  on:
    pull_request:
    push:
      branches: [main]
  jobs:
    backend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with:
            python-version: "3.12"
        - name: Install backend deps
          run: |
            cd backend
            python -m venv .venv
            .venv/bin/pip install -r requirements.txt
        - name: Backend tests (shim AI — CI never calls paid APIs)
          run: |
            cd backend
            AI_PROVIDER=shim .venv/bin/python -m pytest -q
    website:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with:
            node-version: "20"
            cache: pnpm
            cache-dependency-path: website/pnpm-lock.yaml
        - name: Install website deps
          run: cd website && pnpm install --frozen-lockfile
        - name: Typecheck and build
          run: cd website && pnpm exec tsc --noEmit && pnpm build
        - name: Locale parity gate
          run: cd website && node tool/check-locale-parity.mjs
  ```
- RUN: `test -f .github/workflows/ci.yml && grep -q "pytest -q" .github/workflows/ci.yml && grep -q "tsc --noEmit" .github/workflows/ci.yml && grep -q "check-locale-parity" .github/workflows/ci.yml && grep -q "AI_PROVIDER=shim" .github/workflows/ci.yml && echo "ci ok"` (cwd: repo root)
- EXPECT: exit 0, output `ci ok`.
- IF FAIL: fix the workflow file to contain all four gates, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.23 — HUMAN CHECK: Sentry events and CI run
- DO: HUMAN CHECK — the human: (1) triggers a backend Sentry test event via the dev-only `GET /v1/debug/sentry-test` endpoint with `SENTRY_DSN` set, and confirms it lands in the Sentry project tagged with the environment; (2) triggers a website Sentry event (temporary throw in dev tools with `VITE_SENTRY_DSN` set) and confirms it lands; (3) opens a PR and confirms the CI workflow runs all three gates (pytest / tsc+build / locale parity) and fails on a deliberately red check.
- RUN: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/v1/debug/sentry-test` (requires the dev server running with `SENTRY_DSN` set)
- EXPECT: output `500` (the endpoint raises intentionally in dev); the human confirms both Sentry events and the CI behavior.
- IF FAIL: record which of the three checks failed and STOP (playbook §5) with full output.
- [ ]

### Task 6.24 — WS-06 checkpoint: full suite green and commit
- DO: Run the FULL backend suite — it must be completely green (global rule 9; the 45 baseline failures are now repaired). If failures remain, run additional repair sweeps using the task-6.4 protocol (one failing file at a time, code fixes only) BEFORE marking this task; record each extra sweep in your report. Then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && node tool/check-locale-parity.mjs && cd .. && git add -A && git commit -m "phase-00 WS-06: platform plumbing"`
- EXPECT: `0 failed` for the backend suite; `tsc` clean; `pnpm build` succeeds; `locale parity ok`; commit created.
- IF FAIL: more repair sweeps per the DO protocol — never mark this task with a red suite — else STOP (playbook §5) with full output.
- [ ]

## WS-07 — AI foundation gateway (brief M1)  (see instructions.md §WS-07)

> Inline rules (global 10/11/12) for every task here: ALL model calls go
> through `backend/app/services/ai/gateway.py` — never from routers; every
> decision point has a deterministic fallback; the app fully works with
> `AI_PROVIDER=shim`; CI never calls paid APIs; no unmasked Aadhaar/phones/
> emails in any AI payload; every call logged to `ai_decisions` with cost +
> confidence; new AI features launch at `suggest` automation level.

### Task 7.1 — Create ai package with privacy sanitizers
- DO: Create `backend/app/services/ai/__init__.py` (new, empty docstring only) and `backend/app/services/ai/privacy.py` (new) with exactly:
  ```python
  """Payload sanitizers (global rule 11): HMAC user ids, strip phones/emails,
  masked Aadhaar only, trim state to the token budget, chunk oversized states."""
  import hashlib
  import hmac
  import re

  from app.core.config import settings

  PHONE_RE = re.compile(r"(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\+\d{10,12}")
  EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
  AADHAAR_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
  MAX_STATE_TOKENS = 1500
  JEV_CONTEXT_TOKENS = 32000
  USER_ID_KEYS = {"userId", "user_id", "uid", "farmerId", "buyerId", "sellerId", "adminId"}


  def hash_user_id(user_id: str) -> str:
      return hmac.new(settings.ai_hash_salt.encode(), str(user_id).encode(), hashlib.sha256).hexdigest()[:16]


  def sanitize_text(text: str) -> str:
      text = PHONE_RE.sub("[phone]", text)
      text = EMAIL_RE.sub("[email]", text)
      text = AADHAAR_RE.sub("[aadhaar]", text)
      return text


  def _approx_tokens(text: str) -> int:
      return len(text) // 4


  def _clean(value, key: str = ""):
      if isinstance(value, str):
          if key in USER_ID_KEYS:
              return hash_user_id(value)
          return sanitize_text(value)
      if isinstance(value, dict):
          return {k: _clean(v, k) for k, v in value.items()}
      if isinstance(value, list):
          return [_clean(v) for v in value]
      return value


  def sanitize_state(state: dict) -> dict:
      cleaned = _clean(dict(state))
      text = str(cleaned)
      if _approx_tokens(text) > MAX_STATE_TOKENS:
          # trim to the token budget: drop lowest-information keys first
          cleaned = {k: v for k, v in cleaned.items() if k not in ("history", "notes", "description")}
          while _approx_tokens(str(cleaned)) > MAX_STATE_TOKENS and len(cleaned) > 1:
              cleaned.pop(next(reversed(cleaned)))
      return cleaned


  def chunk_state(state: dict) -> list[dict]:
      """Split states larger than the Jev context limit (32k tokens)."""
      if _approx_tokens(str(state)) <= JEV_CONTEXT_TOKENS:
          return [state]
      chunks, current, budget = [], {}, JEV_CONTEXT_TOKENS
      for key, value in state.items():
          cost = _approx_tokens(str({key: value}))
          if cost > budget:
              chunks.append(current)
              current, budget = {}, JEV_CONTEXT_TOKENS
          current[key] = value
          budget -= cost
      if current:
          chunks.append(current)
      return chunks
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.privacy import sanitize_text, hash_user_id; assert sanitize_text('call +919876543210 or a@b.in, aadhaar 1234 5678 9012') == 'call [phone] or [email], aadhaar [aadhaar]'; assert hash_user_id('u1') != 'u1' and hash_user_id('u1') == hash_user_id('u1'); print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the regex/module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.2 — Create question-set registry
- DO: Create `backend/app/services/ai/question_sets.py` (new) with exactly:
  ```python
  """Question-set registry (ai plan §1.1). Scaffolding only — individual sets
  land with their briefs in later phases. automation_level follows
  suggest -> require_confirm -> auto; new sets ALWAYS start at suggest."""

  QUESTION_SETS: dict[str, dict] = {}


  def register_question_set(
      *,
      id: str,
      version: str,
      schema: dict,
      state_builder,
      confidence_threshold: float,
      fallback_fn,
      automation_level: str = "suggest",
      module: str = "",
  ) -> dict:
      qs = {
          "id": id,
          "version": version,
          "schema": schema,
          "state_builder": state_builder,
          "confidence_threshold": confidence_threshold,
          "automation_level": automation_level,
          "fallback_fn": fallback_fn,
          "module": module or id,
      }
      QUESTION_SETS[f"{id}.v{version}"] = qs
      return qs


  def get_question_set(question_set_id: str) -> dict:
      if question_set_id in QUESTION_SETS:
          return QUESTION_SETS[question_set_id]
      if question_set_id.endswith(".v1") is False and f"{question_set_id}.v1" in QUESTION_SETS:
          return QUESTION_SETS[f"{question_set_id}.v1"]
      raise KeyError(f"unknown question set: {question_set_id}")
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.question_sets import register_question_set, get_question_set; register_question_set(id='t', version='1', schema={}, state_builder=lambda s: s, confidence_threshold=0.75, fallback_fn=lambda s: {}); assert get_question_set('t.v1')['automation_level'] == 'suggest'; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.3 — Create golden fixtures directory and sample
- DO: Create directory `backend/tests/fixtures/ai/golden/` (new) and file `backend/tests/fixtures/ai/golden/registration.v1.jsonl` (new) with exactly three lines (registration plumbing is the only set scaffolded this phase — instructions.md §WS-07 out-of-scope note):
  ```jsonl
  {"question_set_id": "registration.v1", "state_hash": "sample-1", "answers": {"preferredLanguage": "hi", "primaryProfile": "farmer"}, "confidence": 0.9}
  {"question_set_id": "registration.v1", "state_hash": "sample-2", "answers": {"preferredLanguage": "en", "primaryProfile": "farmer"}, "confidence": 0.85}
  {"question_set_id": "registration.v1", "state_hash": "sample-3", "answers": {"preferredLanguage": "hi", "primaryProfile": "transport"}, "confidence": 0.8}
  ```
- RUN: `test -f backend/tests/fixtures/ai/golden/registration.v1.jsonl && python3 -c "import json; lines=open('backend/tests/fixtures/ai/golden/registration.v1.jsonl').read().strip().split(chr(10)); [json.loads(l) for l in lines]; print('fixtures ok:', len(lines))"` (cwd: repo root)
- EXPECT: exit 0, output `fixtures ok: 3`.
- IF FAIL: fix the JSONL formatting (one JSON object per line, no trailing commas), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.4 — Create deterministic shim provider
- DO: Create `backend/app/services/ai/shim.py` (new) with exactly:
  ```python
  """Deterministic fixture provider — active when AI_PROVIDER=shim (dev/test/CI).
  Golden answers come from backend/tests/fixtures/ai/golden/<id>.jsonl keyed by
  question-set id; unknown sets return schema-valid defaults."""
  import json
  from pathlib import Path

  GOLDEN_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "ai" / "golden"


  def _load_golden(question_set_id: str) -> list[dict]:
      path = GOLDEN_DIR / f"{question_set_id}.jsonl"
      if not path.exists():
          return []
      return [json.loads(line) for line in path.read_text().strip().splitlines() if line.strip()]


  def _schema_defaults(schema: dict) -> dict:
      defaults = {}
      for key, prop in (schema.get("properties") or {}).items():
          ptype = prop.get("type", "string")
          defaults[key] = {"string": "", "number": 0, "integer": 0, "boolean": False, "array": [], "object": {}}.get(ptype, "")
      return defaults


  async def decide(state: dict, question_set: dict) -> dict:
      golden = _load_golden(f"{question_set['id']}.v{question_set['version']}")
      if golden:
          best = golden[0]
          return {"answers": best["answers"], "confidence": best.get("confidence", 0.8)}
      return {"answers": _schema_defaults(question_set.get("schema") or {}), "confidence": 0.5}


  async def generate(prompt: str, opts: dict | None = None) -> str:
      return f"[shim] {prompt[:120]}"


  async def analyze_image(image_bytes: bytes, prompt: str, schema: dict) -> dict:
      return _schema_defaults(schema or {})


  async def embed(texts: list[str]) -> list[list[float]]:
      return [[float((hash(t) % 1000) / 1000.0)] * 8 for t in texts]
  ```
- RUN: `.venv/bin/python -c "import asyncio; from app.services.ai.shim import decide; r = asyncio.run(decide({}, {'id': 'registration', 'version': '1', 'schema': {}})); assert r['answers']['preferredLanguage'] == 'hi'; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the golden path (`parents[3]` from `backend/app/services/ai/shim.py` resolves to `backend/`), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.5 — Create decision log writer
- DO: Create `backend/app/services/ai/decision_log.py` (new) with exactly:
  ```python
  """Every AI call lands in ai_decisions with cost + confidence (global rule 11).
  90-day TTL to cold storage is a later-phase item."""
  import hashlib
  import json
  import uuid
  from datetime import datetime, timezone

  from app.core.db import set_doc


  async def log_decision(
      *,
      module: str,
      question_set_id: str,
      version: str,
      state: dict,
      answers: dict,
      confidence: float,
      latency_ms: int,
      cost_usd: float,
      model: str,
      fallback_used: bool,
  ) -> str:
      decision_id = f"aid_{uuid.uuid4().hex[:16]}"
      await set_doc(
          "ai_decisions",
          decision_id,
          {
              "decisionId": decision_id,
              "module": module,
              "questionSetId": question_set_id,
              "version": version,
              "stateHash": hashlib.sha256(json.dumps(state, sort_keys=True, default=str).encode()).hexdigest(),
              "answers": answers,
              "confidence": confidence,
              "latencyMs": latency_ms,
              "costUsd": cost_usd,
              "model": model,
              "fallbackUsed": fallback_used,
              "createdAt": datetime.now(timezone.utc).isoformat(),
          },
      )
      return decision_id
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.decision_log import log_decision; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.6 — Create outcomes recorder
- DO: Create `backend/app/services/ai/outcomes.py` (new) with exactly:
  ```python
  """record_outcome links real-world resolution back to a decision — the
  calibration dataset (ai.md §7)."""
  from datetime import datetime, timezone

  from app.core.db import get_doc, set_doc


  async def record_outcome(decision_id: str, outcome: dict) -> dict:
      decision = await get_doc("ai_decisions", decision_id)
      if decision is None:
          raise KeyError(f"unknown decision: {decision_id}")
      decision["outcome"] = outcome
      decision["outcomeRecordedAt"] = datetime.now(timezone.utc).isoformat()
      await set_doc("ai_decisions", decision_id, decision)
      return decision
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.outcomes import record_outcome; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.7 — Create budget guard
- DO: Create `backend/app/services/ai/budget.py` (new) with exactly:
  ```python
  """Per-day cost counters in Redis (ai:cost:<model>:<yyyymmdd>). 80% -> admin
  alert (log surface); 100% -> BudgetExhausted -> the gateway degrades to the
  deterministic fallback (never errors to callers)."""
  import logging
  from datetime import datetime, timezone

  from app.core.cache import REDIS_ERRORS, get_redis
  from app.core.config import settings

  log = logging.getLogger(__name__)


  class BudgetExhausted(Exception):
      pass


  async def track_cost(model: str, cost_usd: float) -> None:
      day = datetime.now(timezone.utc).strftime("%Y%m%d")
      key = f"ai:cost:{model}:{day}"
      try:
          r = await get_redis()
          total = float(await r.incrbyfloat(key, cost_usd))
          if total == cost_usd:
              await r.expire(key, 2 * 86400)
      except REDIS_ERRORS as exc:
          log.warning("budget counter unavailable: %s", exc)
          return
      budget = settings.ai_daily_budget_usd
      if total >= budget:
          raise BudgetExhausted(f"{model} daily budget exhausted: {total:.2f}/{budget}")
      if total >= 0.8 * budget:
          log.warning("AI budget 80%% reached for %s: %.2f/%.2f USD", model, total, budget)
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.budget import BudgetExhausted, track_cost; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.8 — Create Jev OpenRouter client
- DO: Create `backend/app/services/ai/jev_client.py` (new) with exactly:
  ```python
  """Jev via OpenRouter (httpx async). ONE HTTP call per decide() batching all
  questions of the set. Timeout 2 s (retries live in the gateway)."""
  import json

  import httpx

  from app.core.config import settings

  JEV_TIMEOUT = 2.0


  async def decide_batch(state: dict, question_set: dict) -> dict:
      questions = list((question_set.get("schema") or {}).get("properties") or {question_set["id"]: {"type": "object"}})
      messages = [
          {"role": "system", "content": f"You answer a fixed question set as strict JSON with keys: {', '.join(questions)}. Answer every question in one JSON object."},
          {"role": "user", "content": json.dumps(state, default=str)},
      ]
      async with httpx.AsyncClient(timeout=JEV_TIMEOUT) as client:
          resp = await client.post(
              "https://openrouter.ai/api/v1/chat/completions",
              headers={
                  "Authorization": f"Bearer {settings.openrouter_api_key}",
                  "HTTP-Referer": "https://agrovercity.in",
                  "X-Title": "AGROVERCITY",
              },
              json={"model": settings.ai_jev_model, "messages": messages, "response_format": {"type": "json_object"}},
          )
      resp.raise_for_status()
      data = resp.json()
      content = data["choices"][0]["message"]["content"]
      usage = data.get("usage") or {}
      return {"answers": json.loads(content), "confidence": 0.8, "tokens": usage.get("total_tokens", 0)}
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.jev_client import decide_batch, JEV_TIMEOUT; assert JEV_TIMEOUT == 2.0; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: fix the module, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.9 — Create Gemini client
- DO: Create `backend/app/services/ai/gemini_client.py` (new) with exactly (`google-genai` is already in `backend/requirements.txt`; AI Studio key direct — NEVER OpenRouter for Gemini):
  ```python
  """Gemini via the google-genai SDK with the AI Studio key. Timeout 20 s.
  Includes a count-tokens helper for cost logging."""
  import asyncio

  from google import genai
  from google.genai import types

  from app.core.config import settings

  GEMINI_TIMEOUT = 20.0


  def _client() -> genai.Client:
      return genai.Client(api_key=settings.gemini_api_key)


  def count_tokens(text: str, model: str | None = None) -> int:
      return _client().models.count_tokens(model=model or settings.ai_gemini_model, contents=text).total_tokens


  async def generate(prompt: str, json_schema: dict | None = None, lang: str | None = None) -> str:
      config = {}
      if json_schema is not None:
          config = {"response_mime_type": "application/json", "response_schema": json_schema}
      if lang:
          prompt = f"{prompt}\n\nRespond in language: {lang}"
      response = await asyncio.wait_for(
          asyncio.to_thread(_client().models.generate_content, model=settings.ai_gemini_model, contents=prompt, config=types.GenerateContentConfig(**config) if config else None),
          timeout=GEMINI_TIMEOUT,
      )
      return response.text


  async def analyze_image(image_bytes: bytes, prompt: str, schema: dict) -> dict:
      import json as _json
      response = await asyncio.wait_for(
          asyncio.to_thread(
              _client().models.generate_content,
              model=settings.ai_gemini_model,
              contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"), prompt],
              config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema),
          ),
          timeout=GEMINI_TIMEOUT,
      )
      return _json.loads(response.text)


  async def embed(texts: list[str]) -> list[list[float]]:
      response = await asyncio.wait_for(
          asyncio.to_thread(_client().models.embed_content, model=settings.ai_gemini_embed_model, contents=texts),
          timeout=GEMINI_TIMEOUT,
      )
      return [e.values for e in response.embeddings]
  ```
- RUN: `.venv/bin/python -c "from app.services.ai.gemini_client import generate, analyze_image, embed, count_tokens, GEMINI_TIMEOUT; assert GEMINI_TIMEOUT == 20.0; print('ok')"` (cwd: `backend/`)
- EXPECT: exit 0, output `ok`.
- IF FAIL: confirm `google-genai>=2.0.0` is installed (`.venv/bin/pip show google-genai`); if missing run `.venv/bin/pip install -r requirements.txt` ONCE, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.10 — Add AI config keys to Settings
- DO: (1) Edit `backend/app/core/config.py`: add fields to `Settings`: `ai_provider: str = "shim"` (set `AI_PROVIDER=live` only in prod; shim in dev/test/CI — CI never calls paid APIs), `ai_jev_model: str = "typesafe/jev-1.13"`, `ai_gemini_model: str = "gemini-2.5-flash"`, `ai_gemini_model_lite: str = "gemini-2.5-flash-lite"`, `ai_gemini_model_pro: str = "gemini-2.5-pro"`, `ai_gemini_embed_model: str = "gemini-embedding-001"`, `ai_daily_budget_usd: float = 50`, `ai_hash_salt: str = "dev-ai-hash-salt"`. (The existing `openrouter_api_key`, `gemini_api_key`, `gemini_model` fields stay.) (2) Edit `backend/.env.example`: append matching keys: `AI_PROVIDER=shim`, `AI_JEV_MODEL=typesafe/jev-1.13`, `AI_GEMINI_MODEL=gemini-2.5-flash`, `AI_GEMINI_MODEL_LITE=gemini-2.5-flash-lite`, `AI_GEMINI_MODEL_PRO=gemini-2.5-pro`, `AI_GEMINI_EMBED_MODEL=gemini-embedding-001`, `AI_DAILY_BUDGET_USD=50`, `AI_HASH_SALT=dev-ai-hash-salt`, plus `GEMINI_API_KEY=` if absent.
- RUN: `.venv/bin/python -c "from app.core.config import settings; print(settings.ai_provider, settings.ai_jev_model, settings.ai_daily_budget_usd)"` (cwd: `backend/`)
- EXPECT: exit 0, output `shim typesafe/jev-1.13 50.0`.
- IF FAIL: fix the field additions, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.11 — Create gateway with DecisionResult contract
- DO: Create `backend/app/services/ai/gateway.py` (new) with exactly:
  ```python
  """The SINGLE AI entry point (brief M1 / ai plan §1.1). Routers never call
  OpenRouter/Gemini directly (global rule 10). Every decision point has a
  deterministic fallback — callers get a DecisionResult, never an exception."""
  import asyncio
  import time
  from typing import Any, Literal

  from pydantic import BaseModel

  from app.core.config import settings
  from app.core.db import get_doc, set_doc
  from app.services.ai import shim
  from app.services.ai.budget import BudgetExhausted, track_cost
  from app.services.ai.decision_log import log_decision
  from app.services.ai.privacy import sanitize_state
  from app.services.ai.question_sets import get_question_set

  RETRIES = 2


  class DecisionResult(BaseModel):
      answers: dict[str, Any]
      confidence: float
      source: Literal["jev", "gemini", "fallback", "shim"]
      escalated: bool
      decision_id: str
      latency_ms: int


  # --- platform_config/ai reader with 60 s cache (ai plan §1.2) ---
  _ai_config_cache: dict = {"at": 0.0, "doc": None}


  async def get_ai_config() -> dict:
      if time.monotonic() - _ai_config_cache["at"] < 60 and _ai_config_cache["doc"] is not None:
          return _ai_config_cache["doc"]
      doc = await get_doc("platform_config", "ai")
      if doc is None:
          doc = {"modules": {}, "thresholds": {}, "automation": {}}
          await set_doc("platform_config", "ai", doc)
      _ai_config_cache.update(at=time.monotonic(), doc=doc)
      return doc


  async def _fallback(state: dict, question_set: dict, latency_ms: int, reason: str) -> DecisionResult:
      answers = question_set["fallback_fn"](state)
      decision_id = await log_decision(
          module=question_set["module"], question_set_id=question_set["id"], version=question_set["version"],
          state=state, answers=answers, confidence=0.0, latency_ms=latency_ms,
          cost_usd=0.0, model="fallback", fallback_used=True,
      )
      return DecisionResult(answers=answers, confidence=0.0, source="fallback", escalated=False, decision_id=decision_id, latency_ms=latency_ms)


  async def decide(state: dict, question_set_id: str, ctx: dict | None = None) -> DecisionResult:
      started = time.monotonic()
      question_set = get_question_set(question_set_id)
      clean = sanitize_state(state)
      config = await get_ai_config()
      if config.get("modules", {}).get(question_set["module"], True) is False:
          return await _fallback(clean, question_set, int((time.monotonic() - started) * 1000), "module flag off")
      if settings.ai_provider == "shim":
          result = await shim.decide(clean, question_set)
          latency_ms = int((time.monotonic() - started) * 1000)
          decision_id = await log_decision(
              module=question_set["module"], question_set_id=question_set["id"], version=question_set["version"],
              state=clean, answers=result["answers"], confidence=result["confidence"], latency_ms=latency_ms,
              cost_usd=0.0, model="shim", fallback_used=False,
          )
          return DecisionResult(answers=result["answers"], confidence=result["confidence"], source="shim", escalated=False, decision_id=decision_id, latency_ms=latency_ms)
      from app.services.ai import jev_client
      last_error: Exception | None = None
      for attempt in range(RETRIES + 1):
          try:
              result = await jev_client.decide_batch(clean, question_set)
              cost = (result.get("tokens") or 0) * 0.0000005
              await track_cost(settings.ai_jev_model, cost)
              latency_ms = int((time.monotonic() - started) * 1000)
              decision_id = await log_decision(
                  module=question_set["module"], question_set_id=question_set["id"], version=question_set["version"],
                  state=clean, answers=result["answers"], confidence=result["confidence"], latency_ms=latency_ms,
                  cost_usd=cost, model=settings.ai_jev_model, fallback_used=False,
              )
              escalated = result["confidence"] < question_set["confidence_threshold"]
              return DecisionResult(answers=result["answers"], confidence=result["confidence"], source="jev", escalated=escalated, decision_id=decision_id, latency_ms=latency_ms)
          except BudgetExhausted:
              break
          except Exception as exc:
              last_error = exc
              if attempt < RETRIES:
                  await asyncio.sleep(0.2 * (attempt + 1))
      return await _fallback(clean, question_set, int((time.monotonic() - started) * 1000), str(last_error or "budget exhausted"))


  async def generate(prompt: str, opts: dict | None = None) -> str:
      config = await get_ai_config()
      module = (opts or {}).get("module", "generate")
      if config.get("modules", {}).get(module, True) is False:
          return ""
      if settings.ai_provider == "shim":
          return await shim.generate(prompt, opts)
      from app.services.ai import gemini_client
      try:
          text = await gemini_client.generate(prompt, json_schema=(opts or {}).get("schema"), lang=(opts or {}).get("lang"))
          await track_cost(settings.ai_gemini_model, 0.0001)
          return text
      except BudgetExhausted:
          return ""
      except Exception:
          return ""


  async def analyze_image(image_bytes: bytes, prompt: str, schema: dict) -> dict:
      if settings.ai_provider == "shim":
          return await shim.analyze_image(image_bytes, prompt, schema)
      from app.services.ai import gemini_client
      try:
          result = await gemini_client.analyze_image(image_bytes, prompt, schema)
          await track_cost(settings.ai_gemini_model, 0.001)
          return result
      except BudgetExhausted:
          return {}
      except Exception:
          return {}


  async def embed(texts: list[str]) -> list[list[float]]:
      if settings.ai_provider == "shim":
          return await shim.embed(texts)
      from app.services.ai import gemini_client
      try:
          vectors = await gemini_client.embed(texts)
          await track_cost(settings.ai_gemini_embed_model, 0.00001 * len(texts))
          return vectors
      except Exception:
          return [[] for _ in texts]
  ```
- RUN: `.venv/bin/python -c "import asyncio; from app.services.ai.gateway import decide, DecisionResult; from app.services.ai.question_sets import register_question_set; register_question_set(id='smoke', version='1', schema={'properties': {'x': {'type': 'string'}}}, state_builder=lambda s: s, confidence_threshold=0.75, fallback_fn=lambda s: {'x': 'fb'}); r = asyncio.run(decide({'x': 'hi'}, 'smoke.v1')); assert isinstance(r, DecisionResult) and r.source == 'shim'; print('ok', r.source)"` (cwd: `backend/`)
- EXPECT: exit 0, output contains `ok shim` (the in-process Firestore call will warn/fail on missing credentials — if it raises, that is the real-Firestore path; in that case wrap the check in the test fixture instead and note it, the full check runs in task 7.13 with fakes).
- IF FAIL: fix the failing import/logic, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.12 — Create platform_config/ai seed script
- DO: Create `backend/scripts/seed_ai_config.py` (new): mirror `backend/scripts/seed_app_config.py`'s structure; it writes the Firestore doc `platform_config/ai` with exactly `{"modules": {}, "thresholds": {"<id>.v1": 0.75}, "automation": {"<id>.v1": "suggest"}}` (placeholder keys per instructions.md §WS-07 step 2 — real question-set ids are added with their briefs; edits to this doc are maker-checker + audited, admin console lands in phase-07).
- RUN: `.venv/bin/python -c "import scripts.seed_ai_config"` (cwd: `backend/`) — import-only check.
- EXPECT: exit 0.
- IF FAIL: fix the import path/style, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.13 — Create AI gateway tests
- PRECONDITION: `grep -n "walk_packages" backend/tests/conftest.py` — if this fails, STOP the phase (playbook §5): WS-06 task 6.2 (conftest auto-discovery) is missing.
- DO: Create `backend/tests/test_ai_gateway.py` (new) with:
  1. `test_shim_decide_round_trip` — register a question set `gw_test.v1` (schema with one string property, fallback_fn returning `{"q1": "fallback"}`); `result = await decide({"q1": "x"}, "gw_test.v1")` → `result.source == "shim"`, valid `DecisionResult`, and an `ai_decisions` doc exists in `user_store` with `costUsd` present.
  2. `test_shim_generate_round_trip` — `await generate("hello")` returns the `[shim]` prefixed string.
  3. `test_fallback_on_client_exception` — monkeypatch `app.core.config.settings.ai_provider` to `"live"` and `app.services.ai.jev_client.decide_batch` to raise `RuntimeError`; `decide(...)` → `source == "fallback"`, answers come from `fallback_fn`, and the logged `ai_decisions` doc has `fallbackUsed: True`. No exception reaches the caller.
  4. `test_budget_trip_degrades_cleanly` — provider `"live"`, monkeypatch `app.services.ai.gateway.track_cost` to raise `BudgetExhausted`; `decide(...)` → `source == "fallback"`.
  5. `test_privacy_sanitizer` — `sanitize_text` strips a phone, an email, and a 12-digit Aadhaar pattern; `sanitize_state({"userId": "uid-raw-1", "phone": "+919876543210"})` HMACs the id (≠ raw) and strips the phone.
  6. `test_module_flag_off` — seed `user_store["platform_config/ai"] = {"modules": {"gw_test": False}, "thresholds": {}, "automation": {}}`; `decide(...)` → `source == "fallback"` and the logged doc has `fallbackUsed: True`.
  Use the `client`, `user_store`, `monkeypatch` fixtures; call the async gateway functions directly (pytest asyncio_mode=auto). Reset `app.services.ai.gateway._ai_config_cache` between flag tests (`monkeypatch.setattr` it to `{"at": 0.0, "doc": None}`).
- RUN: `AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_ai_gateway.py` (cwd: `backend/`)
- EXPECT: exit 0, `6 passed`.
- IF FAIL: print the failure, align the test to the implemented contract (tasks 7.1–7.11 are the truth), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.14 — Refactor chatbot through the gateway
- PRECONDITION: `test -f backend/app/services/ai/gateway.py` — if this fails, STOP the phase (playbook §5).
- DO: Edit `backend/app/services/chatbot.py`: read the whole file first; KEEP all prompt-building logic unchanged; replace the direct Gemini/model call with `from app.services.ai.gateway import generate` and `text = await generate(prompt, {"module": "chatbot"})` (adapt to the file's actual function shape); keep the existing deterministic fallback for empty results. NO direct `google`/OpenRouter imports may remain in this file.
- RUN: `.venv/bin/python -m pytest -q tests/test_chatbot.py && grep -n "genai\|openrouter" app/services/chatbot.py; test $? -eq 1` (cwd: `backend/`)
- EXPECT: tests pass AND the grep finds nothing (exit 1).
- IF FAIL: remove the missed direct model import, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.15 — Refactor disease model through the gateway
- DO: Edit `backend/app/services/disease_model/gemini.py` AND `backend/app/services/disease_model/base.py` (read both first): route the image analysis through `gateway.analyze_image(image_bytes, prompt, schema)`; make the existing `stub.py` the explicit fallback when the gateway returns `{}`, and where the stub's result is surfaced add the label `"demo"` to its output dict (e.g. `"source": "demo"`) so demo data is never presented as real.
- RUN: `.venv/bin/python -m pytest -q -k "disease or intelligence"` (cwd: `backend/`)
- EXPECT: exit 0, all selected tests pass.
- IF FAIL: fix the refactor to satisfy the existing tests (they encode the contract), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.16 — Note the grading model fallback seam
- DO: Edit `backend/app/services/grading_model/__init__.py`: add (or extend) the module docstring with exactly this sentence: `Grading stays stubbed here; the real implementation is AI brief M10 (phase-05) and will plug into services/ai/gateway.py at this seam.` No code change.
- RUN: `grep -n "brief M10" backend/app/services/grading_model/__init__.py` (cwd: repo root)
- EXPECT: exit 0, one matching line.
- IF FAIL: add the docstring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 7.17 — HUMAN CHECK: live decide() against staging key
- DO: HUMAN CHECK — the human, with a real staging `OPENROUTER_API_KEY` in env, runs:
  ```bash
  cd backend && AI_PROVIDER=live .venv/bin/python -c "
  import asyncio
  from app.services.ai.gateway import decide, generate
  from app.services.ai.question_sets import register_question_set
  register_question_set(id='live_smoke', version='1', schema={'properties': {'crop': {'type': 'string'}}}, state_builder=lambda s: s, confidence_threshold=0.5, fallback_fn=lambda s: {'crop': 'unknown'})
  r = asyncio.run(decide({'district': 'Nashik'}, 'live_smoke.v1'))
  print(r.source, r.confidence, r.decision_id)
  print(asyncio.run(generate('Say namaste in one word')))
  "
  ```
  Then they inspect Firestore: an `ai_decisions` doc with the printed `decision_id` exists and carries `costUsd > 0` and `confidence`.
- RUN: `grep -c "decision_id" backend/app/services/ai/gateway.py` (sanity that the contract field exists; the live call itself is the human's step)
- EXPECT: exit 0 (count ≥ 1); the human confirms a valid `DecisionResult` from the live call and the `ai_decisions` doc with cost.
- IF FAIL: record the live-call error verbatim and STOP (playbook §5) — do not fake the live check.
- [ ]

### Task 7.18 — WS-07 checkpoint: shim suite and commit
- DO: Run the full WS-07 Verification block (brief-M1 standard) from instructions.md, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm build && cd .. && git add -A && git commit -m "phase-00 WS-07: AI foundation gateway"`
- EXPECT: the ENTIRE backend suite passes under `AI_PROVIDER=shim`; `pnpm build` succeeds; commit created.
- IF FAIL: fix failures in files WS-07 touched; record pre-existing unrelated failures per the ordering note — else STOP (playbook §5) with full output.
- [ ]

## Phase-final gate

### Task G.1 — Backend suite fully green
- DO: Run the complete backend suite (exit-gate item: the 45 failing tests are fixed).
- RUN: `cd backend && .venv/bin/python -m pytest -q 2>&1 | tail -3` (cwd: repo root)
- EXPECT: output ends with a summary containing `0 failed` (only `passed`/`warnings`).
- IF FAIL: return to the WS-06 repair-sweep protocol (task 6.4) for the remaining file(s) — never proceed with a red suite — else STOP (playbook §5) with full output.
- [ ]

### Task G.2 — Shim AI suite green
- DO: Run the complete backend suite with the shim provider (exit-gate + global rule 10).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q 2>&1 | tail -3` (cwd: repo root)
- EXPECT: output ends with `0 failed`.
- IF FAIL: fix the shim-path failure (CI must never call paid APIs), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task G.3 — Website typecheck and build clean
- DO: Run the website gate.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build && node tool/check-locale-parity.mjs` (cwd: repo root)
- EXPECT: `tsc` exit 0; `pnpm build` succeeds; output ends with `locale parity ok`.
- IF FAIL: fix the reported type/build/locale error, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task G.4 — No demo backdoor reachable in prod mode
- DO: Run the scripted prod-guard proof: prod boot without secrets must fail; the prod-guard regression tests must pass; the demo-string sweep must show only dev-gated hits.
- RUN: `cd backend && (APP_ENV=prod JWT_SECRET= .venv/bin/python -c "from app.main import app" 2>&1 | grep -q jwt_secret) && .venv/bin/python -m pytest -q tests/test_prod_guards.py && cd .. && grep -rn 'sess_demo\|dev-user\|demo-\|"1234"' backend/app website/src | grep -v 'app/routers/auth.py' | grep -v 'app/core/security.py'; test $? -eq 1` (cwd: repo root)
- EXPECT: the prod boot fails with `jwt_secret` in the error; `5 passed` for the guard tests; the sweep grep finds NOTHING outside `app/routers/auth.py` (dev-gated) and `app/core/security.py` (denylist) — final `test $? -eq 1` succeeds.
- IF FAIL: identify which of the three proofs failed and return to the owning WS-01 task — else STOP (playbook §5) with full output.
- [ ]

### Task G.5 — HUMAN CHECK: Razorpay staging round-trip
- DO: HUMAN CHECK — exit-gate item 3: with staging TEST keys the human proves: real Razorpay test order → signed webhook (signature-verified; a `payment_events` doc exists) → `POST /v1/payments/verify` returns success → refund round-trip → `POST /v1/jobs/payments/reconcile` shows `mismatched: 0`.
- RUN: `curl -s -X POST http://localhost:8000/v1/payments/order -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -H 'Idempotency-Key: gate-check-1' -d '{"amountPaisa":100,"purpose":"gate","refId":"gate-1"}' | head -c 200` (human substitutes a real token against the staging URL)
- EXPECT: a Razorpay order id in the response; the human confirms the full chain including reconcile `mismatched: 0`.
- IF FAIL: record which link of the chain failed and STOP (playbook §5) with full output.
- [ ]

### Task G.6 — HUMAN CHECK: entitlement block proof
- DO: HUMAN CHECK — exit-gate item 4: the human repeats task 5.16 steps 1–4 on staging: over-limit vehicle create returns 402 with the `ENTITLEMENT_EXCEEDED` envelope containing `{limit, used, planId}`; after activating a test subscription the same request succeeds.
- RUN: `curl -s http://localhost:8000/v1/billing/plans | head -c 200` (requires the server running)
- EXPECT: plans JSON returned; the human confirms the 402 envelope payload and the post-upgrade success.
- IF FAIL: record the failing step and STOP (playbook §5) with full output.
- [ ]

### Task G.7 — HUMAN CHECK: KYC pending-to-verified flow
- DO: HUMAN CHECK — exit-gate item 5: the human repeats task 4.17 on staging: wizard submit → case in the real queue → admin review (verify 4 docs, reject RC with reason) → status page shows per-doc states + reason → re-upload → full verify → case `verified`.
- RUN: `curl -s http://localhost:8000/v1/kyc/matrix | head -c 200` (requires the server running)
- EXPECT: the matrices JSON returned; the human confirms the full `pending → verified` round-trip.
- IF FAIL: record the failing step and STOP (playbook §5) with full output.
- [ ]

### Task G.8 — HUMAN CHECK: live AI decision and budget fallback
- DO: HUMAN CHECK — exit-gate item 6: the human (1) confirms task 7.17's live `decide()` wrote an `ai_decisions` doc with cost + confidence; (2) repeats the call with `AI_DAILY_BUDGET_USD=0` in env → the caller gets a clean fallback result (no exception), logged with `fallbackUsed: True`.
- RUN: `cd backend && AI_PROVIDER=live AI_DAILY_BUDGET_USD=0 .venv/bin/python -c "import asyncio; from app.services.ai.question_sets import register_question_set; from app.services.ai.gateway import decide; register_question_set(id='budget_smoke', version='1', schema={'properties': {'x': {'type': 'string'}}}, state_builder=lambda s: s, confidence_threshold=0.5, fallback_fn=lambda s: {'x': 'fb'}); r = asyncio.run(decide({'x': '1'}, 'budget_smoke.v1')); print(r.source)"` (human runs with a live key set; expects `fallback`)
- EXPECT: output `fallback`; the human confirms both halves.
- IF FAIL: record the actual behavior and STOP (playbook §5) with full output.
- [ ]

### Task G.9 — HUMAN CHECK: admin audit-trail flow
- DO: HUMAN CHECK — phase-final manual flow 6: with the server running the human (1) calls any admin mutation WITH `X-Admin-Role: superadmin` + `X-Audit-Reason: gate check` → succeeds; (2) confirms a new `audit_logs` doc with `{adminId, role, action, targetId, reason, at}` exists; (3) repeats WITHOUT the reason header → 400 `AUDIT_REASON_REQUIRED`.
- RUN: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/v1/admin/users/some-uid/status -H 'Content-Type: application/json' -H 'Authorization: Bearer <admin-firebase-token>' -d '{"status":"suspended","reason":"gate"}'` (human substitutes a real admin token)
- EXPECT: output `400` (missing `X-Audit-Reason`); the human confirms the with-headers variant writes the `audit_logs` doc.
- IF FAIL: record the actual status/body and STOP (playbook §5) with full output.
- [ ]

### Task G.10 — Global verification gate (README §4)
- DO: Run every command of the global verification gate (`execution-plan/README.md` §4): backend suite green; website typecheck + build clean; locale-parity check; full suite under `AI_PROVIDER=shim`; and confirm each workstream's manual end-to-end flow (tasks 1.22, 2.21, 3.29, 4.17, 5.16, 6.23, 7.17) has been exercised and confirmed — no "coming soon" reachable on the surfaces this phase shipped.
- RUN: `cd backend && .venv/bin/python -m pytest -q && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && node tool/check-locale-parity.mjs` (cwd: repo root)
- EXPECT: every command exits 0; the human-confirmed manual flows from G.5–G.9 are recorded in your report.
- IF FAIL: return to the owning workstream's checkpoint task — the phase is NOT done — else STOP (playbook §5) with full output.
- [ ]

### Task G.11 — Phase-final commit
- DO: Commit everything once G.1–G.10 pass.
- RUN: `git add -A && git commit -m "phase-00: SaaS foundation & hardening + AI foundation — exit gate green"` (cwd: repo root)
- EXPECT: commit created (git-identity failure is non-blocking per playbook §6 — note it and report).
- IF FAIL: note the git error in the report and continue to the session report — else STOP (playbook §5) with full output.
- [ ]
