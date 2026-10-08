"""WS-07 M32 glossary-protection test for the locale translation pipeline."""
import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "translate_locales.py"
_spec = importlib.util.spec_from_file_location("translate_locales", SCRIPT)
translate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(translate)


async def test_shim_drafts_preserve_glossary(tmp_path, monkeypatch):
    written: dict = {}

    async def _fake_set_doc(collection, doc_id, data):
        written[doc_id] = data

    monkeypatch.setattr(translate, "set_doc", _fake_set_doc)

    # Use a locale that still has missing keys (ta is fully translated by the
    # WS-07 pipeline). The out_dir override keeps the repo clean.
    drafts = await translate.generate_drafts("kn", shim=True, out_dir=tmp_path)
    assert drafts, "expected draft keys for an incomplete locale"

    assert (tmp_path / "kn.draft.ts").exists()
    assert "export const status = 'ai-draft'" in (tmp_path / "kn.draft.ts").read_text()

    en = translate.parse_locale("en")
    for key, draft in drafts.items():
        source = en[key]
        for term in translate.GLOSSARY:
            if term in source:
                assert term in draft, f"{term!r} was translated in {key}"

    assert any(doc.get("status") == "pending" for doc in written.values())
