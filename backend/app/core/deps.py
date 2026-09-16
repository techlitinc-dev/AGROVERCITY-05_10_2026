from fastapi import Header, HTTPException

from app.services.tokens import decode_token


async def current_user_id(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "MISSING_TOKEN",
                "message": "missing or malformed Authorization header",
                "fieldErrors": {},
            },
        )
    return decode_token(authorization[len("Bearer "):], "access")
