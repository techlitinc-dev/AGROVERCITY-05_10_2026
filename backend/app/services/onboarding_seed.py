"""Post-registration dashboard seeding (phase-08 WS-01, tasks 1.44 + 1.45).

So the first dashboard is already populated the moment registration
completes:

1.  Scheme matches (M21 `schemes.match.v1`) — the existing matching service is
    consumed verbatim (rules decide eligibility, the model only ranks), the
    top matches are stored on the user doc under `onboarding.schemesMatches`.
2.  One starter course (M20 `courses.recommend.v1`) — the top recommendation
    from the existing per-farmer recommender, stored under
    `onboarding.starterCourse`.
3.  KYC-lite checklist (task 1.45) — one task-engine task per required document
    of each chosen persona (`kyc.doc_matrix_for`), minus the documents the user
    already has in the vault (`eligibility.missing_documents`).

Everything is resilient: any AI/service failure is logged and swallowed —
registration must never fail because seeding did. Under AI_PROVIDER=shim the
gateway answers deterministically, so dev/CI seeding is stable.
"""
import logging
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services import academy_ai, eligibility, kyc
from app.services.schemes_match import match_schemes
from app.services.tasks import emit_task

log = logging.getLogger(__name__)

# Only the top matches fit on a first dashboard.
MAX_SEEDED_SCHEME_MATCHES = 5

KYC_MODULE = "kyc"
KYC_CHECKLIST_KIND = "kyc_document_checklist"
KYC_DEEP_LINK_BASE = "/dashboard/profile?section=kyc"

# Human labels for the matrix doc types (en + hi). Unknown types fall back to
# the raw token with underscores replaced.
_DOC_LABELS: dict[str, tuple[str, str]] = {
    "aadhaar": ("Aadhaar card", "आधार कार्ड"),
    "pan": ("PAN card", "पैन कार्ड"),
    "bank": ("bank account proof", "बैंक खाते का प्रमाण"),
    "land_712": ("7/12 land record", "7/12 भूमि रिकॉर्ड"),
    "land_tax_receipt": ("land tax receipt", "भूमि कर रसीद"),
    "rc": ("vehicle registration (RC)", "वाहन पंजीकरण (आरसी)"),
    "dl": ("driving licence", "ड्राइविंग लाइसेंस"),
    "apmc_licence": ("APMC licence", "APMC लाइसेंस"),
    "gst": ("GST certificate", "जीएसटी प्रमाणपत्र"),
    "arhtiya_licence": ("commission agent (arhtiya) licence", "आढ़तिया लाइसेंस"),
    "equipment_rc": ("equipment registration (RC)", "यंत्र पंजीकरण (आरसी)"),
    "equipment_insurance": ("equipment insurance", "यंत्र बीमा पत्र"),
    "operator_licence": ("operator licence", "चालक लाइसेंस"),
    "fssai": ("FSSAI licence", "FSSAI लाइसेंस"),
    "iec": ("IEC certificate", "IEC प्रमाणपत्र"),
    "apeda": ("APEDA registration", "APEDA पंजीकरण"),
    "aadhaar_ekyc": ("Aadhaar eKYC record", "आधार ई-केवाईसी रिकॉर्ड"),
    "voter_id": ("voter ID card", "मतदाता पहचान पत्र"),
    "driving_licence": ("driving licence", "ड्राइविंग लाइसेंस"),
    "liveness_selfie": ("liveness selfie", "लाइवनेस सेल्फी"),
    "dgca_remote_pilot_certificate": (
        "DGCA remote pilot certificate",
        "DGCA रिमोट पायलट प्रमाणपत्र",
    ),
    "degree_certificate": ("degree certificate", "उपाधि प्रमाणपत्र"),
    "nabard_nrlm_srlm_empanelment": (
        "NABARD/NRLM/SRLM trainer empanelment",
        "NABARD/NRLM/SRLM प्रशिक्षक पंजीकरण",
    ),
    "instructor_credential": ("instructor credential", "प्रशिक्षक शैक्षणिक योग्यता"),
    "bank_authorisation": ("bank authorisation letter", "बैंक अधिकृत पत्र"),
    "irdai_licence": ("IRDAI licence", "IRDAI लाइसेंस"),
    "wdra_certificate": ("WDRA certificate", "WDRA प्रमाणपत्र"),
    "udyam": ("Udyam registration", "उद्यम पंजीकरण"),
    "trade_licence": ("trade licence", "ट्रेड लाइसेंस"),
    "apmc_mandi_licence": ("APMC mandi licence", "APMC मंडी लाइसेंस"),
    "partnership_deed": ("partnership deed", "साझेदारी विलेख"),
    "llp_agreement": ("LLP agreement", "एलएलपी करार"),
    "moa_aoa": ("MOA/AOA", "एमओए/एओए"),
}


def _labels(doc_type: str) -> tuple[str, str]:
    return _DOC_LABELS.get(doc_type, (doc_type.replace("_", " "), doc_type.replace("_", " ")))


async def _vault_doc_types(uid: str) -> list[str]:
    docs = await query(f"users/{uid}/vault_documents", [], limit=200)
    return [str(d.get("docType") or "") for d in docs if d.get("docType")]


async def _seed_scheme_matches(uid: str, user: dict, lang: str) -> None:
    """Task 1.44a — store the top M21 scheme matches on the user doc."""
    vault_types = await _vault_doc_types(uid)
    profile = {**user, "vaultDocTypes": vault_types}
    schemes = await query("schemes", [], limit=200)
    matches = await match_schemes(profile, schemes, lang=lang, emit_tasks=False)
    seeded = [
        {
            "schemeId": row.get("schemeId"),
            "name": row.get("name"),
            "category": row.get("category"),
            "eligible": bool(row.get("eligible")),
            "fit": row.get("fit"),
        }
        for row in matches[:MAX_SEEDED_SCHEME_MATCHES]
    ]
    user["onboarding"] = {
        **(user.get("onboarding") or {}),
        "schemesMatches": seeded,
        "schemesSeededAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("users", uid, user)


async def _seed_starter_course(uid: str, user: dict) -> None:
    """Task 1.44b — store the top M20 course recommendation on the user doc."""
    result = await academy_ai.recommend_courses(uid)
    recommendations = result.get("data") or []
    if not recommendations:
        return
    top = recommendations[0]
    user["onboarding"] = {
        **(user.get("onboarding") or {}),
        "starterCourse": {
            "courseId": top.get("courseId"),
            "relevance": top.get("relevance"),
            "badges": top.get("badges") or [],
            "source": result.get("source"),
        },
    }
    await set_doc("users", uid, user)


async def _emit_kyc_checklist_tasks(uid: str, personas: list[str], vault_types: list[str]) -> int:
    """Task 1.45 — one dedupe-safe checklist task per missing required document."""
    emitted = 0
    for persona in personas:
        required = kyc.doc_matrix_for(persona)
        missing = eligibility.missing_documents(required, vault_types)
        for doc_type in missing:
            label_en, label_hi = _labels(doc_type)
            await emit_task(
                uid,
                persona=persona,
                module=KYC_MODULE,
                kind=KYC_CHECKLIST_KIND,
                title_en=f"Upload your {label_en} to complete KYC",
                title_hi=f"KYC पूरा करने के लिए {label_hi} अपलोड करें",
                subtitle=f"Required document for {persona} verification",
                priority="upcoming",
                deep_link=f"{KYC_DEEP_LINK_BASE}&docType={doc_type}",
                source_id=doc_type,
            )
            emitted += 1
    return emitted


async def seed_dashboard(uid: str, personas: list[str]) -> dict:
    """Seed a fresh user's dashboard. Never raises: failures are logged and
    the remaining sections still run, so registration always completes."""
    seeded: dict[str, object] = {"schemes": 0, "starterCourse": False, "kycTasks": 0}
    user = await get_doc("users", uid)
    if user is None:
        return seeded
    lang = str(user.get("preferredLanguage") or user.get("language") or "en")

    try:
        await _seed_scheme_matches(uid, user, lang)
        seeded["schemes"] = len((user.get("onboarding") or {}).get("schemesMatches") or [])
    except Exception:  # noqa: BLE001 — seeding must never fail registration
        log.warning("scheme-match seeding failed for uid=%s", uid, exc_info=True)

    try:
        await _seed_starter_course(uid, user)
        seeded["starterCourse"] = bool((user.get("onboarding") or {}).get("starterCourse"))
    except Exception:  # noqa: BLE001 — seeding must never fail registration
        log.warning("starter-course seeding failed for uid=%s", uid, exc_info=True)

    try:
        vault_types = await _vault_doc_types(uid)
        seeded["kycTasks"] = await _emit_kyc_checklist_tasks(uid, personas, vault_types)
    except Exception:  # noqa: BLE001 — seeding must never fail registration
        log.warning("kyc checklist seeding failed for uid=%s", uid, exc_info=True)

    return seeded
