"""Persona → JWT with cached tokens and graceful fallback (specs §7, §18i).

Blocked identities are recorded as findings, not crashes.
"""
import json
import time
from pathlib import Path

import httpx

from .config import RUNS_DIR

CACHE_PATH = RUNS_DIR / ".tokens.json"
DEV_MPIN = "1234"          # dev seeds (PERSONA_DEFAULTS / superadmin operators)
OPERATORS = ("operations_lead", "finance_admin", "compliance_officer",
             "agronomist", "content_moderator", "superadmin")
TTL_S = 22 * 3600          # access tokens default to 24h; refresh 1h early


def _read_cache() -> dict:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}


def _write_cache(c: dict):
    RUNS_DIR.mkdir(exist_ok=True)
    CACHE_PATH.write_text(json.dumps(c, indent=1))


def resolve(client: httpx.Client, base: str, persona: str) -> dict:
    cache = _read_cache()
    hit = cache.get(persona)
    if hit and hit.get("exp", 0) > time.time() + 3600 and not hit.get("blocked"):
        return hit

    ident = _try_quick_login(client, base, persona)
    if ident.get("blocked"):
        ident = _try_dev_otp(client, base, persona)
    if ident.get("blocked"):
        ident = _try_omni_profile(client, base, persona)

    ident["checked_at"] = time.time()
    cache[persona] = ident
    _write_cache(cache)
    return ident


def _activate_profile(client: httpx.Client, base: str, token: str, persona: str):
    """quick-login seeds land on arbitrary activeProfiles (e.g. customer → coldStorageProvider),
    which produces false 403 floods. Force-activate the persona's own profile."""
    try:
        client.post(f"{base}/v1/users/me/profiles/{persona}/activate",
                    headers={"Authorization": f"Bearer {token}"}, timeout=15)
    except Exception:
        pass


def _try_quick_login(client: httpx.Client, base: str, persona: str) -> dict:
    try:
        r = client.post(f"{base}/v1/auth/quick-login",
                        json={"persona": persona, "mpin": DEV_MPIN}, timeout=20)
        if r.status_code == 200:
            d = r.json()
            token = d["accessToken"]
            _activate_profile(client, base, token, persona)
            return {"uid": (d.get("user") or {}).get("id"), "token": token,
                    "exp": time.time() + TTL_S, "via": "quick-login"}
        return {"blocked": True, "reason": f"quick-login {r.status_code}"}
    except Exception as e:
        return {"blocked": True, "reason": f"quick-login error {type(e).__name__}"}


def _try_dev_otp(client: httpx.Client, base: str, persona: str) -> dict:
    """OTP flow; dev responses include devOtp when no SMS provider is configured."""
    try:
        phone = "+91" + f"{abs(hash(persona)) % 9_0000_0000 + 1_0000_0000:010d}"
        s = client.post(f"{base}/v1/auth/otp/send", json={"phone": phone}, timeout=20)
        dev_otp = (s.json() or {}).get("devOtp")
        sid = (s.json() or {}).get("otpSessionId")
        if not dev_otp or not sid:
            return {"blocked": True, "reason": "otp/send gave no devOtp (SMS provider configured?)"}
        v = client.post(f"{base}/v1/auth/otp/verify",
                        json={"phone": phone, "otp": dev_otp, "otpSessionId": sid}, timeout=20)
        if v.status_code == 200:
            d = v.json()
            token = d["accessToken"]
            _activate_profile(client, base, token, persona)
            return {"uid": (d.get("user") or {}).get("id"), "token": token,
                    "exp": time.time() + TTL_S, "via": "dev-otp"}
        return {"blocked": True, "reason": f"otp/verify {v.status_code}"}
    except Exception as e:
        return {"blocked": True, "reason": f"otp error {type(e).__name__}"}


def _try_omni_profile(client: httpx.Client, base: str, persona: str) -> dict:
    """Last resort: omni-user-777 holds 11 linked profiles — login then activate."""
    try:
        r = client.post(f"{base}/v1/auth/quick-login",
                        json={"persona": "omni-user-777", "mpin": DEV_MPIN}, timeout=20)
        if r.status_code != 200:
            return {"blocked": True, "reason": "omni login failed"}
        token = r.json()["accessToken"]
        h = {"Authorization": f"Bearer {token}"}
        a = client.post(f"{base}/v1/users/me/profiles/{persona}/activate", headers=h, timeout=20)
        if a.status_code in (200, 201, 204):
            return {"uid": (r.json().get("user") or {}).get("id"), "token": token,
                    "exp": time.time() + TTL_S, "via": "omni-profile"}
        return {"blocked": True, "reason": f"profile activate {a.status_code} — seed this persona (specs §18i)"}
    except Exception as e:
        return {"blocked": True, "reason": f"omni error {type(e).__name__}"}
