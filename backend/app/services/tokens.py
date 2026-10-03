import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import JWTError, jwt

from app.core.cache import REDIS_ERRORS, get_redis
from app.core.config import settings


def create_access_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_ttl_minutes)
    payload = {"sub": user_id, "type": "access", "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_ttl_days)
    payload = {"sub": user_id, "type": "refresh", "exp": exp, "jti": uuid.uuid4().hex}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "invalid or expired token", "fieldErrors": {}},
        )
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "invalid or expired token", "fieldErrors": {}},
        )
    return payload["sub"]


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
