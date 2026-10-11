"""Task engine router (phase-01 WS-01) — the action layer at /v1/tasks.

Numbers live in /intelligence; this router never duplicates aggregates — it
serves actionable tasks with the standard error envelope, cursor pagination,
and Idempotency-Key-protected transitions.
"""
import asyncio
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, fetch_page
from app.services import idempotency, task_ranking
from app.services import tasks as tasks_service
from app.services.ai.outcomes import record_outcome

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_STATUSES = ("open", "done", "dismissed")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sort_key(task: dict):
    """Urgent first, then dueAt ascending (deterministic tie-break by taskId)."""
    return (
        0 if task.get("priority") == "urgent" else 1,
        task.get("dueAt") or "9999-12-31",
        task.get("taskId") or "",
    )


def _batch_active_on(batch: dict, day: str) -> bool:
    """True when a batch's date window covers `day` (instructor live classes)."""
    start = (batch.get("startDate") or "")[:10]
    end = (batch.get("endDate") or "")[:10]
    return bool(start) and bool(end) and start <= day <= end


class TaskDecisionIn(BaseModel):
    decisionId: str | None = None


async def _own_task(task_id: str, uid: str) -> dict:
    doc = await get_doc(tasks_service.COLLECTION, task_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "TASK_NOT_FOUND", "task not found")
    return doc


async def _maybe_record_outcome(task: dict) -> None:
    """WS-03 outcome hook: task completed within 24 h of being headlined."""
    decision_id = task.get("decisionId")
    if not decision_id:
        return
    decision = await get_doc("ai_decisions", decision_id)
    if decision is None:
        return
    try:
        created = datetime.fromisoformat(decision.get("at"))
    except (TypeError, ValueError):
        return
    if datetime.now(timezone.utc) - created <= timedelta(hours=24):
        try:
            await record_outcome(decision_id, "task-completed-within-24h")
        except ValueError:
            return


@router.get("/today")
async def tasks_today(uid: str = Depends(current_user_id)):
    """Open tasks due today or explicitly prioritized urgent/today, AI-ranked
    via tasks.rank.v1 (deterministic fallback; flag-off = plain due-date order)."""
    rows = await query(
        tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000
    )
    today = date.today().isoformat()
    items = [
        task
        for task in rows
        if task.get("priority") in ("urgent", "today")
        or (task.get("dueAt") or "")[:10] <= today
    ]
    items.sort(key=_sort_key)
    ranked, _headline = await task_ranking.rank_tasks(uid, "all", items)
    return {"items": ranked}


@router.get("")
async def list_tasks(
    persona: str | None = Query(None),
    status: str | None = Query(None),
    cursor: str | None = Query(None),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    if status is not None and status not in VALID_STATUSES:
        _error(400, "INVALID_STATUS", f"status must be one of {', '.join(VALID_STATUSES)}")
    filters: list[tuple[str, str, str]] = [("userId", "==", uid)]
    if persona:
        filters.append(("persona", "==", persona))
    if status:
        filters.append(("status", "==", status))
    try:
        page = await fetch_page(
            tasks_service.COLLECTION,
            filters,
            order_field="createdAt",
            descending=True,
            cursor=cursor,
            page_size=pageSize,
        )
    except InvalidCursor:
        _error(400, "INVALID_CURSOR", "the pagination cursor is malformed")
    return page


@router.post("/{task_id}/done")
async def complete_task(
    task_id: str,
    body: TaskDecisionIn | None = None,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("tasks.done", idempotency_key)
    if stored is not None:
        return stored

    doc = await _own_task(task_id, uid)
    if doc.get("status") == "done":
        response = {"ok": True, "task": doc}
    elif doc.get("status") == "dismissed":
        _error(409, "TASK_ALREADY_DISMISSED", "a dismissed task cannot be completed")
    else:
        doc["status"] = "done"
        doc["updatedAt"] = _now()
        if body is not None and body.decisionId:
            doc["decisionId"] = body.decisionId
        await set_doc(tasks_service.COLLECTION, task_id, doc)
        await _maybe_record_outcome(doc)
        response = {"ok": True, "task": doc}

    await idempotency.store("tasks.done", idempotency_key, response)
    return response


@router.post("/{task_id}/dismiss")
async def dismiss_task(
    task_id: str,
    body: TaskDecisionIn | None = None,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("tasks.dismiss", idempotency_key)
    if stored is not None:
        return stored

    doc = await _own_task(task_id, uid)
    if doc.get("status") == "dismissed":
        response = {"ok": True, "task": doc}
    elif doc.get("status") == "done":
        _error(409, "TASK_ALREADY_DONE", "a completed task cannot be dismissed")
    else:
        doc["status"] = "dismissed"
        doc["updatedAt"] = _now()
        if body is not None and body.decisionId:
            doc["decisionId"] = body.decisionId
        await set_doc(tasks_service.COLLECTION, task_id, doc)
        response = {"ok": True, "task": doc}

    await idempotency.store("tasks.dismiss", idempotency_key, response)
    return response


@router.get("/summary")
async def tasks_summary(
    persona: str | None = Query(None, description="persona id, or the literal all"),
    uid: str = Depends(current_user_id),
):
    """Per-module open counts + top-3 urgent items per persona."""
    from app.services.users import get_user

    user, rows = await asyncio.gather(
        get_user(uid),
        query(tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000),
    )
    if persona and persona != "all":
        rows = [task for task in rows if task.get("persona") == persona]

    grouped: dict[str, dict] = {}
    for task in rows:
        key = task.get("persona") or "unknown"
        bucket = grouped.setdefault(key, {"moduleCounts": {}, "topUrgent": [], "_all": []})
        module = task.get("module") or "unknown"
        bucket["moduleCounts"][module] = bucket["moduleCounts"].get(module, 0) + 1
        bucket["_all"].append(task)

    if grouped:
        # Persona rankings are independent — rank concurrently, then assemble.
        ranked_results = await asyncio.gather(
            *(
                task_ranking.rank_tasks(uid, persona_key, bucket.pop("_all"))
                for persona_key, bucket in grouped.items()
            )
        )
        for (persona_key, bucket), (ranked, _headline) in zip(grouped.items(), ranked_results):
            # WS-03: rank each persona's open tasks; topUrgent keeps its shape but
            # ranked items carry decisionId and the per-persona headline marker.
            urgent = [task for task in ranked if task.get("priority") == "urgent"]
            bucket["topUrgent"] = urgent[:3]

    # All summary-item queries below are independent of one another — fire them
    # concurrently (WS-04 task 4.10: no sequential per-item fetch chains). On the
    # aggregate view (no persona filter) only compute grids for personas the user
    # actually has — farmer stays the default when the profile list is empty.
    profiles = set((user or {}).get("linkedProfiles") or [])
    active = (user or {}).get("activeProfile")
    if active:
        profiles.add(active)

    def _wants(persona_id: str) -> bool:
        if persona == persona_id:
            return True  # explicit request always computes
        if persona not in (None, "all"):
            return False
        if not profiles:
            return persona_id == "farmer"
        return persona_id in profiles

    wants_farmer = _wants("farmer")
    wants_instructor = _wants("instructor")
    wants_customer = _wants("customer")

    from app.services.settlements import _config, course_gmv_pct

    jobs: list = []
    if wants_farmer:
        jobs.append(query("course_purchases", [("userId", "==", uid)], limit=1000))
    if wants_instructor:
        jobs += [
            query("courses", [("instructorId", "==", uid)], limit=500),
            query("course_purchases", [("instructorId", "==", uid)], limit=1000),
            query("course_batches", [("instructorId", "==", uid)], limit=200),
            query("course_assignments", [("instructorId", "==", uid)], limit=500),
            query("course_enquiries", [("instructorId", "==", uid)], limit=500),
            _config(),
        ]
    if wants_customer:
        jobs += [
            query("customer_demands", [("customerId", "==", uid)], limit=500),
            query("customer_quotes", [("customerId", "==", uid)], limit=500),
            query("customer_orders", [("customerId", "==", uid)], limit=500),
            query("customer_favorite_suppliers", [("customerId", "==", uid)], limit=100),
        ]
    results = list(await asyncio.gather(*jobs)) if jobs else []
    cursor = 0

    # WS-01: learner summary grid items for the farmer persona (deep-linked).
    if wants_farmer:
        purchases = results[cursor]
        cursor += 1
        in_progress = sum(
            1
            for p in purchases
            if p.get("status") == "paid" and float(p.get("progressPercent") or 0) < 100
        )
        certificates = sum(1 for p in purchases if p.get("certificateId"))
        farmer_bucket = grouped.setdefault("farmer", {"moduleCounts": {}, "topUrgent": []})
        farmer_bucket["summaryItems"] = {
            "myCoursesProgress": {"count": in_progress, "deepLink": "/dashboard/p/courses"},
            "certificatesEarned": {"count": certificates, "deepLink": "/dashboard/profile"},
        }

    # WS-02 task 2.32: instructor summary grid items, computed from real
    # collections, plus actionable tasks (pending reviews / awaiting enquiries).
    if wants_instructor:
        my_courses = results[cursor]
        instr_purchases = results[cursor + 1]
        batches = results[cursor + 2]
        assignments = results[cursor + 3]
        enquiries = results[cursor + 4]
        config = results[cursor + 5]
        cursor += 6

        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        today = now.date().isoformat()

        paid = [p for p in instr_purchases if p.get("status") == "paid"]
        enrollments_week = sum(1 for p in paid if (p.get("paidAt") or "") >= week_ago)

        live_today = sum(1 for b in batches if _batch_active_on(b, today))

        pending_reviews = sum(1 for a in assignments if a.get("status") == "submitted")

        awaiting_reply = sum(1 for e in enquiries if e.get("status") == "pending")

        # Task-2.19 earnings computation: gross − config-driven commission.
        pct = course_gmv_pct(config)
        gross_paisa = sum(int(round(float(p.get("amountRupees") or 0) * 100)) for p in paid)
        commission_paisa = gross_paisa * pct // 100

        ratings = [c.get("ratingAverage") for c in my_courses if c.get("ratingCount", 0) > 0]
        course_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0

        instructor_bucket = grouped.setdefault("instructor", {"moduleCounts": {}, "topUrgent": []})
        instructor_bucket["summaryItems"] = {
            "enrollmentsThisWeek": {"count": enrollments_week, "deepLink": "/dashboard/p/instructorHome"},
            "liveClassesToday": {"count": live_today, "deepLink": "/dashboard/p/batches"},
            "pendingAssignmentReviews": {
                "count": pending_reviews,
                "deepLink": "/dashboard/p/assignments",
            },
            "enquiriesAwaitingReply": {
                "count": awaiting_reply,
                "deepLink": "/dashboard/p/enquiries",
            },
            "earningsNextPayout": {
                "netPaisa": gross_paisa - commission_paisa,
                "deepLink": "/dashboard/p/earnings",
            },
            "courseRating": {"rating": course_rating, "deepLink": "/dashboard/p/myCourses"},
        }
        if pending_reviews:
            await tasks_service.emit_task(
                uid,
                persona="instructor",
                module="assignments",
                kind="assignment_review",
                title_en="Review submitted assignments",
                title_hi="जमा किए गए असाइनमेंट की समीक्षा करें",
                subtitle=f"{pending_reviews} awaiting review",
                priority="today",
                deep_link="/dashboard/p/assignments",
                source_id=f"{uid}:assignments",
            )
        if awaiting_reply:
            await tasks_service.emit_task(
                uid,
                persona="instructor",
                module="enquiries",
                kind="enquiry_reply",
                title_en="Reply to course enquiries",
                title_hi="पाठ्यक्रम पूछताछ का उत्तर दें",
                subtitle=f"{awaiting_reply} awaiting reply",
                priority="today",
                deep_link="/dashboard/p/enquiries",
                source_id=f"{uid}:enquiries",
            )

    # WS-03 task 3.40: e-market customer summary grid items (real collections)
    # + actionable tasks for quotes awaiting a response and pending inspections.
    if wants_customer:
        now = datetime.now(timezone.utc)
        month_prefix = now.strftime("%Y-%m")
        week_ago = (now - timedelta(days=7)).isoformat()

        demands = results[cursor]
        quotes = results[cursor + 1]
        orders = results[cursor + 2]
        favorites = results[cursor + 3]
        cursor += 4

        open_demands = sum(1 for d in demands if d.get("status", "open") == "open")

        quotes_awaiting = sum(
            1 for q in quotes if q.get("status") in ("pending", "countered", "quote_pending")
        )

        child_orders = [o for o in orders if not o.get("isParent")]
        orders_in_transit = sum(
            1
            for o in child_orders
            if o.get("status") not in ("delivered", "settled", "cancelled", "disputed")
        )
        inspections_pending = [
            o
            for o in child_orders
            if o.get("status") == "delivered"
            and o.get("deliveredAt")
            and not o.get("inspection")
        ]
        spend_month_paisa = sum(
            int(o.get("orderValuePaisa") or 0)
            for o in child_orders
            if (o.get("createdAt") or "")[:7] == month_prefix
        )

        favorite_farmers = {f.get("farmerId") for f in favorites if f.get("farmerId")}
        new_lots = 0
        if favorite_farmers:
            lots = await query("market_lots", [("status", "==", "open")], limit=1000)
            new_lots = sum(
                1
                for lot in lots
                if lot.get("farmerId") in favorite_farmers
                and (lot.get("createdAt") or "") >= week_ago
            )

        customer_bucket = grouped.setdefault("customer", {"moduleCounts": {}, "topUrgent": []})
        customer_bucket["summaryItems"] = {
            "openDemands": {"count": open_demands, "deepLink": "/dashboard/p/demands"},
            "quotesAwaiting": {"count": quotes_awaiting, "deepLink": "/dashboard/p/quotes"},
            "ordersInTransit": {"count": orders_in_transit, "deepLink": "/dashboard/p/orderTracking"},
            "inspectionsPending": {
                "count": len(inspections_pending),
                "deepLink": "/dashboard/p/orderTracking",
            },
            "spendThisMonthPaisa": {
                "paisa": spend_month_paisa,
                "deepLink": "/dashboard/p/orderTracking",
            },
            "favoriteFarmersNewLots": {
                "count": new_lots,
                "deepLink": "/dashboard/p/favorites",
            },
        }
        if quotes_awaiting:
            await tasks_service.emit_task(
                uid,
                persona="customer",
                module="emarket",
                kind="quotes_awaiting",
                title_en="Quotes awaiting your response",
                title_hi="उद्धरण आपके उत्तर की प्रतीक्षा में हैं",
                subtitle=f"{quotes_awaiting} quote(s) open for negotiation",
                priority="today",
                deep_link="/dashboard/p/quotes",
                source_id=f"{uid}:emarket:quotes",
            )
        if inspections_pending:
            first_pending = sorted(
                inspections_pending, key=lambda o: o.get("deliveredAt") or ""
            )[0]
            await tasks_service.emit_task(
                uid,
                persona="customer",
                module="emarket",
                kind="inspection_pending",
                title_en="Inspect your delivered order",
                title_hi="अपनी डिलीवर हुई ऑर्डर की जांच करें",
                subtitle="Delivery awaiting inspection within the 72h window",
                priority="urgent",
                deep_link=f"/dashboard/p/orders/{first_pending['id']}/inspect",
                source_id=f"{uid}:emarket:inspection",
            )
    return {"personas": grouped}
