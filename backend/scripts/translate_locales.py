"""Gemini-assisted locale translation pipeline (WS-07 M32).

Draft convention: drafts are written to
`website/src/lib/i18n/drafts/{locale}.draft.ts` with `export const status =
'ai-draft'` and are NEVER imported by the i18n index, so they are excluded from
the build until approved.

Behavior:
  (a) parse `en.ts` + en module pairs for the full key set; parse the target
      locale's real files for existing keys; diff → missing keys;
  (b) batch missing keys to Gemini (`AI_GEMINI_MODEL`) with the locked `GLOSSARY`
      passed as do-not-translate terms;
  (c) write the draft file;
  (d) upsert one `locale_approvals` doc per drafted key
      `{locale, key, enSource, draft, status: "pending"}` (doc id `{locale}__{key}`).

CLI: `--locale <code>` (required), `--shim` for deterministic offline drafts
(CI/dev never calls paid APIs), optional `--out-dir`.
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

# Terms that must never be translated (agri glossary + brand).
GLOSSARY = [
    "mandi", "khasra", "7/12", "FPO", "PMFBY", "AGROVERCITY",
    "vyapari", "mandi bhav", "kisan", "Razorpay", "UPI",
]

_SCRIPT = Path(__file__).resolve()
_REPO_ROOT = _SCRIPT.parents[2]
_LOCALES_DIR = _REPO_ROOT / "website" / "src" / "lib" / "i18n" / "locales"
_DRAFTS_DIR = _REPO_ROOT / "website" / "src" / "lib" / "i18n" / "drafts"

# key: 'value'  |  'key': 'value' or "value"  (value may start on the next line)
_ENTRY_RE = re.compile(
    r"(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*"
    r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
)


def _unescape(value: str) -> str:
    return (
        value.replace("\\\\", "\x00")
        .replace("\\'", "'")
        .replace('\\"', '"')
        .replace("\x00", "\\")
    )


def _parse_keys_values(path: Path) -> dict:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for match in _ENTRY_RE.finditer(text):
        key = match.group(1) or match.group(2)
        if key and key != "default":
            out[key] = _unescape(match.group(3) if match.group(3) is not None else match.group(4))
    return out


def _locale_files(locale: str) -> list[Path]:
    base = _LOCALES_DIR / f"{locale}.ts"
    modules = sorted(_LOCALES_DIR.glob(f"{locale}.*.ts"))
    return [base, *modules]


def parse_locale(locale: str) -> dict:
    merged: dict[str, str] = {}
    for path in _locale_files(locale):
        merged.update(_parse_keys_values(path))
    return merged


def _translate_batch(missing: dict, locale: str, glossary: list[str]) -> dict:
    """Real translation via Gemini; falls back to the shim wrapper when the
    provider is unavailable so no key is ever dropped."""
    try:
        from app.services.ai.gemini_client import GeminiClient  # local import

        client = GeminiClient()
        glossary_line = ", ".join(glossary)
        drafts: dict[str, str] = {}
        for key, source in missing.items():
            prompt = (
                f"Translate the following UI string into {locale}. Keep these terms "
                f"untranslated: {glossary_line}. Return only the translation.\n{source}"
            )
            drafts[key] = asyncio.get_event_loop().run_until_complete(
                client.generate(prompt)
            )
        return drafts
    except Exception:  # noqa: BLE001 — no provider → deterministic shim
        return {key: f"[{locale}] {source}" for key, source in missing.items()}


def _write_draft_file(locale: str, drafts: dict, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{locale}.draft.ts"
    lines = [
        "// AI draft — excluded from the build until approved.",
        "export const status = 'ai-draft';",
        "",
        "const draft: Record<string, string> = {",
    ]
    for key, value in drafts.items():
        safe = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"  '{key}': '{safe}',")
    lines.append("};")
    lines.append("")
    lines.append("export default draft;")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


async def generate_drafts(locale: str, shim: bool = True, out_dir: Path | None = None) -> dict:
    en = parse_locale("en")
    existing = parse_locale(locale)
    missing = {key: value for key, value in en.items() if key not in existing}

    if shim or not missing:
        drafts = {key: f"[{locale}] {value}" for key, value in missing.items()}
    else:
        drafts = _translate_batch(missing, locale, GLOSSARY)

    target_dir = Path(out_dir) if out_dir else _DRAFTS_DIR
    _write_draft_file(locale, drafts, target_dir)

    for key, draft in drafts.items():
        await set_doc(
            "locale_approvals",
            f"{locale}__{key}",
            {
                "locale": locale,
                "key": key,
                "enSource": missing[key],
                "draft": draft,
                "status": "pending",
            },
        )
    return drafts


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate locales with Gemini (WS-07).")
    parser.add_argument("--locale", required=True)
    parser.add_argument("--shim", action="store_true", help="deterministic offline drafts")
    parser.add_argument("--out-dir", default=None)
    args = parser.parse_args()
    drafts = asyncio.run(generate_drafts(args.locale, shim=args.shim, out_dir=args.out_dir))
    print(f"{args.locale}: wrote {len(drafts)} draft keys")


if __name__ == "__main__":
    main()
