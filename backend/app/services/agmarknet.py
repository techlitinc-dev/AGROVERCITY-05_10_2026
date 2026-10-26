"""Agmarknet (agmarknet.gov.in) public dashboard client.

Source of truth for the "Live Mandi Prices" feature. Uses only the captcha-free
POST /v1/dashboard-data/ endpoint — the same call the Agmarknet homepage table
makes — to fetch daily modal prices, arrivals and MSP per commodity.

Network note: this server's system DNS filters *.gov.in names, so the API IP is
resolved via DNS-over-HTTPS and pinned for the connection (urllib3 honours the
stdlib getaddrinfo; httpx's anyio backend does not).
"""
import asyncio
import json
import logging
import socket
import threading
import time
from datetime import date
from urllib import parse

import urllib3

log = logging.getLogger(__name__)

API_HOST = "api.agmarknet.gov.in"
API_BASE = f"https://{API_HOST}/v1"
DOH_ENDPOINT = "https://dns.google/resolve"

# Last-known good A record, used when DoH is unreachable.
FALLBACK_IP = "34.93.98.149"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
}

# Sentinel ids the homepage itself sends for "All <x>".
ALL_GROUP = 100000
ALL_COMMODITY = 100001
ALL_VARIETY = 100021
ALL_STATE = 100006
ALL_DISTRICT = 100007
ALL_MARKET = 100009
GRADE_FAQ = 4

DASHBOARD = "marketwise_price_arrival"

_ip_cache: dict[str, tuple[float, str]] = {}
_ip_lock = threading.Lock()
_pool = urllib3.PoolManager(timeout=30)


class AgmarknetError(RuntimeError):
    """Raised when the upstream Agmarknet call fails."""


def _resolve_ip(host: str) -> str:
    """Resolve via DNS-over-HTTPS (system DNS filters gov.in); cache 30 min."""
    now = time.monotonic()
    with _ip_lock:
        cached = _ip_cache.get(host)
        if cached and now - cached[0] < 1800:
            return cached[1]
    ip = FALLBACK_IP
    try:
        resp = _pool.request(
            "GET",
            f"{DOH_ENDPOINT}?name={parse.quote(host)}&type=A",
            headers={"Accept": "application/dns-json"},
        )
        answers = json.loads(resp.data).get("Answer", [])
        for ans in answers:
            if ans.get("type") == 1:
                ip = ans["data"]
                break
    except Exception as exc:  # noqa: BLE001 — any DoH failure falls back
        log.warning("DoH resolve failed for %s (%s) — using fallback IP", host, exc)
    with _ip_lock:
        _ip_cache[host] = (now, ip)
    return ip


def _request(method: str, path: str, **kwargs) -> dict:
    """HTTP call with the gov.in IP pinned (stdlib resolver patch)."""
    orig_getaddrinfo = socket.getaddrinfo

    def patched(host, port, *args, **kw):
        if host == API_HOST:
            return orig_getaddrinfo(_resolve_ip(host), port, *args, **kw)
        return orig_getaddrinfo(host, port, *args, **kw)

    socket.getaddrinfo = patched
    try:
        resp = _pool.request(
            method,
            f"{API_BASE}{path}",
            headers={**BROWSER_HEADERS, **kwargs.pop("headers", {})},
            **kwargs,
        )
    except Exception as exc:  # noqa: BLE001 — transport level
        raise AgmarknetError(f"agmarknet request failed: {exc}") from exc
    finally:
        socket.getaddrinfo = orig_getaddrinfo

    if resp.status != 200:
        raise AgmarknetError(f"agmarknet HTTP {resp.status} for {path}")
    try:
        return json.loads(resp.data)
    except ValueError as exc:
        raise AgmarknetError("agmarknet returned a non-JSON response") from exc


def fetch_filters_sync() -> dict:
    return _request("GET", "/daily-price-arrival/filters")["data"]


def fetch_dashboard_sync(
    group_ids: list[int] | None = None,
    commodity_ids: list[int] | None = None,
    on_date: str | None = None,
    limit: int = 250,
) -> list[dict]:
    """Daily modal price / arrival / MSP rows for the given scope.

    `on_date` is YYYY-MM-DD (defaults to today upstream). Returns the raw
    record list: cmdt_name, cmdt_grp_name, msp_price, as_on_price,
    one_day_ago_price, two_day_ago_price, *_arrival (MT), trend, reported_date.
    """
    payload = {
        "dashboard": DASHBOARD,
        "date": on_date or date.today().isoformat(),
        "group": group_ids or [ALL_GROUP],
        "commodity": commodity_ids or [ALL_COMMODITY],
        "variety": ALL_VARIETY,
        "state": ALL_STATE,
        "district": [ALL_DISTRICT],
        "market": [ALL_MARKET],
        "grades": [GRADE_FAQ],
        "limit": limit,
        "format": "json",
    }
    body = json.dumps(payload)
    data = _request(
        "POST",
        "/dashboard-data/",
        body=body,
        headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
    )
    if not data.get("status"):
        # "No data available" is a legitimate empty day/scope, not a failure.
        if "no data" in str(data.get("message", "")).lower():
            return []
        raise AgmarknetError(f"agmarknet: {data.get('message', 'unknown error')}")
    return ((data.get("data") or {}).get("records")) or []


async def fetch_filters() -> dict:
    return await asyncio.to_thread(fetch_filters_sync)


async def fetch_dashboard(
    group_ids: list[int] | None = None,
    commodity_ids: list[int] | None = None,
    on_date: str | None = None,
    limit: int = 250,
) -> list[dict]:
    return await asyncio.to_thread(
        fetch_dashboard_sync, group_ids, commodity_ids, on_date, limit
    )
