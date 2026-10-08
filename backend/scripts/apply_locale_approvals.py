"""Apply approved locale drafts into the real locale files (WS-07 M32).

Reads `locale_approvals` docs with status "approved" and `applied != true`;
inserts `{key}: {draft}` into `website/src/lib/i18n/locales/{locale}.ts` before
its closing brace (skips keys already present), then marks the docs `applied`.
CLI: `--locale <code>` optional filter;
`--locale <code> --approve-all` bulk-approves pending drafts (reviewedBy
"script:bulk").
"""
import argparse
import asyncio
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import query, set_doc

_SCRIPT = Path(__file__).resolve()
_REPO_ROOT = _SCRIPT.parents[2]
_LOCALES_DIR = _REPO_ROOT / "website" / "src" / "lib" / "i18n" / "locales"


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


async def approve_all(locale: str) -> int:
    docs = await query(
        "locale_approvals", [("locale", "==", locale), ("status", "==", "pending")], limit=10000
    )
    now = datetime.now(timezone.utc).isoformat()
    for doc in docs:
        doc["status"] = "approved"
        doc["reviewedBy"] = "script:bulk"
        doc["reviewedAt"] = now
        await set_doc("locale_approvals", f"{locale}__{doc['key']}", doc)
    return len(docs)


async def apply(locale: str | None = None) -> int:
    filters = [("status", "==", "approved")]
    if locale:
        filters.append(("locale", "==", locale))
    docs = await query("locale_approvals", filters, limit=10000)

    by_locale: dict[str, list[dict]] = {}
    for doc in docs:
        if doc.get("applied"):
            continue
        by_locale.setdefault(doc["locale"], []).append(doc)

    written = 0
    for code, items in by_locale.items():
        path = _LOCALES_DIR / f"{code}.ts"
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        additions = []
        for item in items:
            key = item["key"]
            pattern = rf"(?<![A-Za-z0-9_$]){re.escape(key)}(?![A-Za-z0-9_$])\s*:"
            if re.search(pattern, text):
                continue
            additions.append(f"  '{key}': '{_escape(item['draft'])}',")
        if additions:
            idx = text.rfind("}")
            text = text[:idx] + "\n".join(additions) + "\n" + text[idx:]
            path.write_text(text, encoding="utf-8")
            written += len(additions)
        for item in items:
            item["applied"] = True
            await set_doc("locale_approvals", f"{code}__{item['key']}", item)
    return written


async def _run(args) -> None:
    if args.approve_all and args.locale:
        print("approved", await approve_all(args.locale))
    print("applied", await apply(args.locale))


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply approved locale drafts (WS-07).")
    parser.add_argument("--locale", default=None)
    parser.add_argument("--approve-all", action="store_true")
    args = parser.parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
