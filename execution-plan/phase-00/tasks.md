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
- [ ]

### Task 2.2 — Route admin.py through core deps admin_user
- DO: Edit `backend/app/routers/admin.py`: (1) delete the `_require_admin` function (~L24–32) and the `_admin_user` function (~L35–40), including the hardcoded UID fallback (`admin-root`, `uid-admin`, `admin-demo`); (2) replace `from app.core.deps import current_user_id` with `from app.core.deps import admin_user`; (3) replace every `Depends(_admin_user)` with `Depends(admin_user)`; (4) in every handler, replace `user["id"]` with `user["uid"]` (Firebase claims carry `uid`, not `id`); (5) remove now-unused imports (`current_user_id`, `get_user` if unused elsewhere in the file — check before removing).
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: command completes; failures caused by the auth-mechanism switch are expected here and fixed in task 2.5 — no 500s from `NameError`/`ImportError` (i.e. no test may error with a missing `_admin_user` reference).
- IF FAIL: `grep -n "_admin_user\|_require_admin" app/routers/admin.py` must return nothing — remove the missed reference, re-run — else STOP (playbook §5) with full output.
- [ ]

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
- [ ]

### Task 2.4 — Wire admin_action into admin mutations
- DO: Edit `backend/app/routers/admin.py`: (1) add `from app.core.deps import admin_user, admin_action` (replace the task-2.2 import); (2) on EVERY mutating endpoint (`@router.post` / `@router.put` / `@router.delete` in this file — at minimum `update_user_status`, `review_kyc_document`, the claim-adjudication endpoint, and the expert-ticket resolve endpoint) add a dependency parameter `_audit: dict = Depends(admin_action("<ACTION_NAME>"))` where `<ACTION_NAME>` is the existing audit action string for that endpoint (e.g. `"UPDATE_USER_STATUS"`, `"REVIEW_KYC_DOC"`). Read-only `@router.get` endpoints keep `Depends(admin_user)` only.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: command completes; admin mutations without the new headers now 400 `AUDIT_REASON_REQUIRED` — failing assertions about that are fixed in task 2.5.
- IF FAIL: fix any `NameError`/signature error, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.5 — Update admin tests for new auth path
- DO: Edit `backend/tests/test_admin.py`: make every admin request use a Firebase admin identity — header `Authorization: Bearer admin-token` (the conftest token from task 2.1) — and make every admin MUTATION also send `X-Admin-Role: superadmin` and `X-Audit-Reason: test reason`. Where a test asserts 403 for a non-admin, use `Bearer plain-token`. Where a test asserts the old hardcoded-UID behavior, update it to assert 403 for `plain-token` instead (this is adapting tests to the WS-02 spec, not weakening them — the spec changed per instructions.md §WS-02 steps 1–2). Never delete an assertion without replacing it with the equivalent new-mechanism assertion.
- RUN: `.venv/bin/python -m pytest -q tests/test_admin.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the remaining header/identity mismatch in the failing test, re-run — else STOP (playbook §5) with full output.
- [ ]

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
- [ ]

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
- [ ]

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
- [ ]

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
- [ ]

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
- [ ]

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
- [ ]

### Task 2.12 — Add rotation, replay, and session tests
- DO: Edit `backend/tests/test_auth.py`: append new tests (use the existing `client`, `user_store`, `fake_redis` fixtures; each new test must first `monkeypatch.setattr("app.services.tokens.get_redis", lambda: _fake())` where `_fake` is an async function returning the `fake_redis` fixture — request `fake_redis` and `monkeypatch` as test parameters):
  1. `test_refresh_rotation_invalidates_old` — login (seed a user with a known MPIN via `user_store`), call `/v1/auth/refresh` with the refresh token → 200 with a NEW refresh token; calling `/v1/auth/refresh` again with the OLD token → 401.
  2. `test_refresh_replay_revokes_family` — login, refresh once (token B), replay token A → 401 `REFRESH_REPLAYED`; then token B must ALSO be rejected (401).
  3. `test_sessions_list_and_revoke` — login twice (two refresh tokens), `GET /v1/auth/sessions` with the access token → 2 sessions; `DELETE /v1/auth/sessions/{first jti}` → `{"ok": true}`; using the first refresh token afterwards → 401; the second refresh token still works.
  (Get each token's `jti` in the test via `app.services.tokens.decode_refresh_token`.)
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py -k "rotation or replay or sessions"` (cwd: `backend/`)
- EXPECT: exit 0, the 3 new tests pass.
- IF FAIL: print the 401/500 body in the failing test and align it with the implemented behavior (the implementation is the truth per instructions.md §WS-02 steps 3–4), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.13 — Add mpinReentryRequired flag to session store
- DO: Edit `website/src/stores/session.ts`: add state field `mpinReentryRequired: boolean` (initial `false`), an action `setMpinReentryRequired(v: boolean)`, and make the existing `clear()` also reset `mpinReentryRequired` to `false`. Persist it alongside the existing persisted fields if the store uses `persist`.
- RUN: `pnpm exec tsc --noEmit` (cwd: `website/`)
- EXPECT: exit 0.
- IF FAIL: match the store's existing zustand patterns exactly, re-run — else STOP (playbook §5) with full output.
- [ ]

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
- [ ]

### Task 2.15 — Build MPIN re-entry sheet with i18n
- DO: (1) Create `website/src/views/auth/MpinReentrySheet.tsx` (new): a sheet/modal styled like the existing `ForgotMpinSheet.tsx` (read it first and mirror its structure) with a 4-digit MPIN input and submit; on submit it calls `POST /v1/auth/mpin/verify` then `POST /v1/auth/refresh` (via the existing wrappers in `website/src/lib/api/auth.ts` — read it and reuse; add a `verifyMpin` wrapper there if none exists), on success calls `setMpinReentryRequired(false)` and navigates back to `window.history.back()`-equivalent route state, on failure shows the error text from the envelope (NO `alert()` — playbook §3 rule 3). All user-facing strings via `t()`. (2) Edit `website/src/lib/i18n/locales/en.ts` AND `website/src/lib/i18n/locales/hi.ts`: add matching keys `auth.mpinReentry.title` ("Session expired — re-enter MPIN" / "सत्र समाप्त — MPIN दोबारा दर्ज करें"), `auth.mpinReentry.subtitle`, `auth.mpinReentry.submit`, `auth.mpinReentry.failed`. (3) Edit `website/src/views/auth/AuthView.tsx`: when the URL has `?reentry=mpin` or `mpinReentryRequired` is true, render `MpinReentrySheet` instead of the login choices.
- RUN: `pnpm exec tsc --noEmit && node -e "const en=require('fs').readFileSync('src/lib/i18n/locales/en.ts','utf8');const hi=require('fs').readFileSync('src/lib/i18n/locales/hi.ts','utf8');for(const k of ['mpinReentry']){if(!en.includes(k)||!hi.includes(k))process.exit(1)}console.log('parity ok')"` (cwd: `website/`)
- EXPECT: `tsc` exit 0 and output `parity ok` (keys present in BOTH locale files — playbook §3 rule 3).
- IF FAIL: add the missing locale key(s) to whichever file lacks them, re-run — else STOP (playbook §5) with full output.
- [ ]

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
- [ ]

### Task 2.17 — Rate-limit auth login and OTP surfaces
- DO: Edit `backend/app/routers/auth.py`: (1) add `from app.core.ratelimit import hit` and `from fastapi import Request` to imports; (2) in `login_with_phone_mpin` add a `request: Request` parameter and as the first statement `await hit("login", f"{request.client.host if request.client else 'unknown'}:{_normalize_phone(body.phone)}", 10, 600)` (10 per 10 min per IP+phone); (3) in `mpin_reset` (the OTP-request surface), after `decoded = _verify_firebase_token(body.idToken)` add `await hit("otp", decoded.get("phone_number") or decoded["uid"], 5, 600)` (5 per 10 min per phone).
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass (no Redis in tests → fail-open).
- IF FAIL: fix the call placement, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.18 — Test OTP rate limit returns 429
- DO: Edit `backend/tests/test_auth.py`: append `test_otp_rate_limit_429` — request `client`, `user_store`, `fake_redis`, `monkeypatch`; monkeypatch `app.core.ratelimit.get_redis` with an async function returning `fake_redis`; seed `user_store["users/uid-1"] = {"id": "uid-1", "phone": "+919812345678"}`; call `POST /v1/auth/mpin/reset` six times with `{"idToken": "any", "newMpin": "9876"}` (conftest's fake Firebase verify returns phone `+919812345678`); assert calls 1–5 are not 429 and call 6 returns 429 with envelope code `RATE_LIMITED`.
- RUN: `.venv/bin/python -m pytest -q tests/test_auth.py -k rate_limit` (cwd: `backend/`)
- EXPECT: exit 0, 1 test passes.
- IF FAIL: check the reset handler's idempotency on repeated newMpin (calls 1–5 may legitimately 200/404 — assert only "not 429" for those), adjust the seeding, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.19 — Rate-limit Razorpay order/verify endpoints
- DO: Edit `backend/app/routers/orders.py`: (1) add `from app.core.ratelimit import hit` to imports; (2) in `razorpay_order` and `razorpay_verify`, as the first statement of each: `await hit("payments", uid, 20, 60)` (20/min per user).
- RUN: `.venv/bin/python -m pytest -q tests/test_orders.py tests/test_order_lifecycle.py` (cwd: `backend/`)
- EXPECT: exit 0, all pass.
- IF FAIL: fix the call placement, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.20 — Rate-limit chat message send
- DO: Edit `backend/app/routers/chat.py`: (1) add `from app.core.ratelimit import hit` to imports; (2) in the `POST /rooms/{room_id}/messages` handler (~L164), as the first statement after the user id is known: `await hit("chat", uid, 60, 60)` (60/min per user — use the handler's actual user-id variable name).
- RUN: `.venv/bin/python -m pytest -q tests/test_chatbot.py` (cwd: `backend/`) — there is no dedicated chat-router test file; this guards against import breakage.
- EXPECT: exit 0, all pass.
- IF FAIL: run `.venv/bin/python -c "from app.routers import chat"` to surface the error, fix, re-run — else STOP (playbook §5) with full output.
- [ ]

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
- [ ]
