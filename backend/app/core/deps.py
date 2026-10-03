from datetime import datetime, timezone

import firebase_admin.auth as firebase_auth
from fastapi import Depends, Header, HTTPException, Request

from app.core.db import set_doc
from app.services.tokens import decode_token


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def current_user_id(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        _error(401, "MISSING_TOKEN", "missing or malformed Authorization header")
    return decode_token(authorization[len("Bearer "):], "access")


# /v1/admin/* is the ONE exception to the backend-JWT rule: the admin console signs
# in with Firebase Auth (email/password) directly and sends the Firebase ID token;
# access is gated on the `admin` custom claim (set via scripts/make_admin.py).
async def admin_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        _error(401, "MISSING_TOKEN", "missing or malformed Authorization header")
    try:
        claims = firebase_auth.verify_id_token(
            authorization[len("Bearer "):], check_revoked=True
        )
    except Exception:
        _error(401, "INVALID_TOKEN", "invalid or revoked Firebase ID token")
    if claims.get("admin") is not True:
        _error(403, "ADMIN_REQUIRED", "यह खाता एडमिन नहीं है")
    return claims


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
