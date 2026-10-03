from fastapi import HTTPException
from passlib.context import CryptContext

from app.core.config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_mpin(mpin: str) -> str:
    return pwd_ctx.hash(mpin)


def verify_mpin(mpin: str, hashed: str) -> bool:
    return pwd_ctx.verify(mpin, hashed)


def validate_mpin_format(mpin: str):
    if len(mpin) != 4 or not mpin.isascii() or not mpin.isdigit():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_MPIN_FORMAT",
                "message": "MPIN must be exactly 4 digits",
                "fieldErrors": {"mpin": "must be exactly 4 ASCII digits"},
            },
        )
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
