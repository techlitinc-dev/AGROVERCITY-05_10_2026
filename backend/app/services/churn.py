"""M28 churn re-engagement (phase-08 WS-01).

Nightly job: score users dormant ≥ 7 days with `churn.signal.v1` (Jev, `suggest`)
and, above the risk threshold, emit a re-engagement task + notification through
the M7 dispatch path (quiet hours respected by `notify_user`). Reads only
activity recency — no PII in the AI payload (rule 11). Gateway failures degrade
to the deterministic inactivity-days fallback and log `fallbackUsed`.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.db import delete_doc, get_doc, query, set_doc
from app.services.ai import config_store, gateway, privacy
from app.services.ai.config import ALLOWLIST  # noqa: F401 — documents the hard cap
from app.services.ai.outcomes import record_outcome
from app.services.notify import notify_user
from app.services.tasks import emit_task

log = logging.getLogger(__name__)

MODULE = "churn_signal"
QUESTION_SET_ID = "churn.signal.v1"
DORMANCY_DAYS = 7
CHURN_RISK_THRESHOLD = 0.5
TOUCH_COLLECTION = "churn_touch"
RETURN_WINDOW_HOURS = 72

HOOK_COPY = {
    "mandi_price_move": {
        "en": "Mandi prices moved for your crop — check today's rates.",
        "hi": "आपकी फसल के मंडी भाव बदले हैं — आज के रेट देखें।",
    },
    "pending_offer": {
        "en": "You have a pending offer waiting for your response.",
        "hi": "आपके पास एक लंबित ऑफर आपके जवाब का इंतज़ार कर रहा है।",
    },
    "new_scheme": {
        "en": "A new government scheme may match your profile.",
        "hi": "एक नई सरकारी योजना आपकी प्रोफ़ाइल से मेल खा सकती है।",
    },
    "course_reminder": {
        "en": "Continue your Krishi Academy course — a few lessons left.",
        "hi": "अपना कृषि अकादमी कोर्स पूरा करें — कुछ पाठ बाकी हैं।",
    },
}


async def score_dormant_users(now: datetime | None = None) -> dict:
    """Score dormant users and emit re-engagement touches for high-risk ones."""
    now = now or datetime.now(timezone.utc)
    if not await config_store.module_enabled(MODULE):
        return {"scored": 0, "emitted": 0, "notified": 0, "flagOff": True}

    users = await query("users", limit=5000)
    scored = emitted = notified = 0
    for user in users:
        uid = user.get("id")
        if not uid:
            continue
        state = await privacy.build_churn_state(uid, now=now)
        inactivity = int(state.get("inactivity_days") or 0)
        if inactivity < DORMANCY_DAYS:
            continue
        scored += 1
        decision = await gateway.decide(state, QUESTION_SET_ID, module=MODULE)
        answers = decision.answers or {}
        risk = float(answers.get("churn_risk") or 0.0)
        if risk < CHURN_RISK_THRESHOLD:
            continue
        hook = str(answers.get("best_hook") or "course_reminder")
        copy = HOOK_COPY.get(hook, HOOK_COPY["course_reminder"])
        await emit_task(
            uid,
            persona=user.get("activeProfile") or "farmer",
            module="retention",
            kind="churn_reengagement",
            title_en="We miss you — come back to Agrovercity",
            title_hi="हम आपको याद कर रहे हैं — वापस आएँ",
            subtitle=copy["en"],
            priority="upcoming",
            deep_link="/dashboard",
            source_id=f"churn:{uid}",
        )
        await notify_user(
            uid,
            type="churn_reengagement",
            title="Come back / वापस आएँ",
            body=copy["en"],
            deepLink="/dashboard",
        )
        await set_doc(
            TOUCH_COLLECTION,
            str(uid),
            {
                "uid": str(uid),
                "decisionId": decision.decision_id,
                "hook": hook,
                "at": now.isoformat(),
            },
        )
        emitted += 1
        notified += 1
    return {"scored": scored, "emitted": emitted, "notified": notified, "flagOff": False}


async def record_return(user_id: str, now: datetime | None = None) -> str | None:
    """Outcome hook (task 1.25): a user returns within 72h of a churn touch.

    Records `returned_within_72h` against the touch's decision and clears the
    touch so a later login does not double-count.
    """
    now = now or datetime.now(timezone.utc)
    touch = await get_doc(TOUCH_COLLECTION, str(user_id))
    if not touch:
        return None
    try:
        at = datetime.fromisoformat(str(touch.get("at")))
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
    except ValueError:
        await delete_doc(TOUCH_COLLECTION, str(user_id))
        return None
    if now - at > timedelta(hours=RETURN_WINDOW_HOURS):
        await delete_doc(TOUCH_COLLECTION, str(user_id))
        return None
    decision_id = touch.get("decisionId")
    await delete_doc(TOUCH_COLLECTION, str(user_id))
    if not decision_id:
        return None
    await record_outcome(decision_id, "returned_within_72h")
    return decision_id
