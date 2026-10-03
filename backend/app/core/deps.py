import firebase_admin.auth as firebase_auth
from fastapi import Header, HTTPException

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
