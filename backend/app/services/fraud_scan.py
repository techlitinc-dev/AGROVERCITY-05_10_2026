"""Fraud feature builder + nightly scan (WS-03 M8).

`build_cluster_features` returns pure-data feature dicts per user (device-token
hashes, reciprocal trades, referral rings, coin velocity) — no AI calls. The
nightly job scores each cluster via `trust.fraud.v1` and, above the risk
threshold, soft-holds pending settlements/payouts and queues a `fraud_queue`
entry. It NEVER bans, forfeits, or changes a user status (suggest level).
"""
import hashlib
from datetime import datetime, timezone

from app.core.db import query, set_doc
from app.services.ai import gateway, privacy

FRAUD_MODULE = "trust_fraud"
RISK_THRESHOLD = 0.8


async def build_cluster_features() -> list[dict]:
    users = await query("users", [], limit=2000)
    user_ids = [u.get("id") for u in users if u.get("id")]

    # shared device tokens: a token hash used by more than one account.
    token_owners: dict[str, set[str]] = {}
    for uid in user_ids:
        devices = await query(f"users/{uid}/devices", [], limit=100)
        for device in devices:
            token = device.get("token") or device.get("id") or ""
            token_hash = hashlib.sha256(str(token).encode()).hexdigest()[:16]
            token_owners.setdefault(token_hash, set()).add(uid)
    shared: dict[str, int] = {}
    for owners in token_owners.values():
        if len(owners) > 1:
            for uid in owners:
                shared[uid] = shared.get(uid, 0) + 1

    # circular trades: reciprocal broker-deal edges (A→B and B→A).
    deals = await query("broker_deals", [], limit=2000)
    edges = {
        (d.get("brokerId"), d.get("sellerUid"))
        for d in deals
        if d.get("brokerId") and d.get("sellerUid")
    }
    circular: dict[str, int] = {}
    for a, b in edges:
        if (b, a) in edges:
            circular[a] = circular.get(a, 0) + 1
            circular[b] = circular.get(b, 0) + 1

    # referral rings: a referral cycle (A→B→…→A).
    attributions = await query("referral_attributions", [], limit=2000)
    up = {
        a["referredUid"]: a["referrerUid"]
        for a in attributions
        if a.get("referredUid") and a.get("referrerUid")
    }
    ring_size: dict[str, int] = {}
    for uid in user_ids:
        seen: list[str] = []
        current = uid
        for _ in range(12):
            nxt = up.get(current)
            if not nxt:
                break
            if nxt == uid:
                ring_size[uid] = len(seen) + 1
                break
            if nxt in seen:
                break
            seen.append(nxt)
            current = nxt

    features: list[dict] = []
    for uid in user_ids:
        ledger = await query(f"users/{uid}/coin_ledger", [], limit=500)
        features.append(
            {
                "userId": uid,
                "sharedDevices": shared.get(uid, 0),
                "circularTrades": circular.get(uid, 0),
                "referralRingSize": ring_size.get(uid, 0),
                "coinVelocity": len(ledger),
            }
        )
    return features


async def run_fraud_scan() -> dict:
    """Nightly fraud batch: score clusters, soft-hold + queue high-risk accounts."""
    features = await build_cluster_features()
    now = datetime.now(timezone.utc).isoformat()
    holds = queued = 0
    for feature in features:
        uid = feature["userId"]
        state = privacy.sanitize_state(
            {k: v for k, v in feature.items() if k != "userId"}
        )
        decision = await gateway.decide(state, "trust.fraud.v1", module=FRAUD_MODULE)
        answers = decision.answers or {}
        risk = float(answers.get("risk") or 0.0)
        if risk <= RISK_THRESHOLD:
            continue

        settlements = await query("settlements", [("entityId", "==", uid)], limit=1000)
        for settlement in settlements:
            if settlement.get("status") != "pending":
                continue
            settlement["softHold"] = True
            await set_doc("settlements", settlement["id"], settlement)
            holds += 1
        await set_doc(
            "fraud_queue",
            f"fraud_{uid}",
            {
                "userId": uid,
                "pattern": answers.get("pattern") or "none",
                "risk": risk,
                "decisionId": decision.decision_id,
                "reason": f"risk {risk} · pattern {answers.get('pattern')}",
                "status": "open",
                "createdAt": now,
            },
        )
        queued += 1
    return {"clusters": len(features), "holds": holds, "queued": queued}
