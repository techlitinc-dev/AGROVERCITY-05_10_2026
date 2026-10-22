"""Settings + config-file loading, with env overrides and the localhost guard (specs §12)."""
import os
from functools import lru_cache
from pathlib import Path

import yaml

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent          # sim/
CONFIG_DIR = ROOT / "config"
RUNS_DIR = ROOT / "runs"
REPORTS_DIR = ROOT / "reports"
PERSONA_REPORTS_DIR = ROOT / "persona_reports"


def _load_yaml(name: str) -> dict:
    p = CONFIG_DIR / name
    return yaml.safe_load(p.read_text()) if p.exists() else {}


@lru_cache
def settings() -> dict:
    s = _load_yaml("settings.yaml")
    s["backend_url"] = os.environ.get("SIM_BACKEND_URL", s.get("backend_url", "http://localhost:8000")).rstrip("/")
    s["model"] = os.environ.get("SIM_MODEL", s.get("model", "deepseek-flash"))
    if not s.get("allow_nonlocal_backend"):
        host = s["backend_url"].split("//", 1)[-1].split(":", 1)[0].split("/")[0]
        if host not in ("localhost", "127.0.0.1", "::1"):
            raise SystemExit(f"REFUSING non-local backend {s['backend_url']} — "
                             "set allow_nonlocal_backend: true only for dedicated staging (specs §12)")
    return s


def personas() -> dict:
    return {p["id"]: p for p in _load_yaml("personas.yaml").get("personas", [])}


def scenarios() -> list[dict]:
    return _load_yaml("scenarios.yaml").get("scenarios", [])


def persona_tools() -> dict:
    return _load_yaml("persona_tools.yaml")


def severity() -> dict:
    return _load_yaml("severity.yaml").get("domain_weights", {"default": 1})


def slo() -> dict:
    return _load_yaml("slo.yaml")


def known_gaps() -> list[dict]:
    return _load_yaml("known_gaps.yaml").get("verdicts", [])


def llm_credentials() -> tuple[str, str]:
    """(api_key, base_url). DeepSeek default; any OpenAI-compatible provider works."""
    key = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
    base = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com")
    return key, base.rstrip("/")
