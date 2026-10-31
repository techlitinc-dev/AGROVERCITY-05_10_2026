from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "AGROVERCITY API"
    env: str = Field(default="dev", validation_alias=AliasChoices("APP_ENV", "ENV"))
    firebase_service_account_path: str = "secrets/firebase-service-account.json"
    firebase_project_id: str = "agrovercity-bafec"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60 * 24
    jwt_refresh_ttl_days: int = 30
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    bank_verify_provider: str = "stub"
    # Identity verification (KYC) provider: "mock" serves the internal mock
    # DigiLocker screen (default, dev/no-SSL testing servers); "sandbox" drives
    # the real DigiLocker consent flow through the Sandbox.co.in KYC API
    # (OAuth-style redirect, document pull, Aadhaar XML storage).
    kyc_provider: str = "mock"
    # Restricted onboarding token TTL — the registration/KYC journey only.
    kyc_onboarding_ttl_minutes: int = 30
    # Sandbox.co.in KYC API credentials (https://console.sandbox.co.in). Empty
    # = sandbox provider unavailable. The API base selects the environment:
    # production https://api.sandbox.co.in, test https://test-api.sandbox.co.in
    sandbox_api_key: str = ""
    sandbox_api_secret: str = ""
    sandbox_api_base_url: str = "https://api.sandbox.co.in"
    sandbox_api_version: str = "1.0"
    # HTTP timeout for Sandbox API calls (seconds).
    sandbox_api_timeout_seconds: int = 20
    # Public HTTPS base of THIS backend — Sandbox redirects the user's browser
    # here after DigiLocker consent ({base}/v1/kyc/sessions/oauth/callback).
    # Must be publicly reachable over HTTPS for the real flow to complete.
    sandbox_api_redirect_base: str = ""
    # Public base URL of the web app — KYC authorization/callback URLs point here.
    web_app_base_url: str = "http://localhost:5173"
    # OTP SMS delivery. Empty = no provider wired → /auth/otp/send runs in dev
    # mode and surfaces `devOtp` in the response (non-prod environments only).
    sms_provider: str = ""
    escrow_dispute_window_hours: int = 24
    billing_grace_period_days: int = 7
    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    weather_api_key: str = ""
    # Google Maps geo provider. Empty = mock adapter (deterministic stub).
    google_maps_api_key: str = ""
    sentry_dsn: str = ""
    cron_secret: str = ""
    gemini_api_key: str = ""
    # Government open-data mandi price feed (data.gov.in records proxied via
    # techlitinc.in). Base URL only — the service appends /mandi_prices.php.
    mandi_gov_data_base_url: str = "https://techlitinc.in/mandi_api"
    gemini_model: str = "gemini-3.8-flash"
    ai_provider: str = "shim"
    ai_jev_model: str = "typesafe/jev-1.13"
    ai_gemini_model: str = "gemini-3.8-flash"
    ai_gemini_model_lite: str = "gemini-3.5-flash-lite"
    # Crop planner: latency-critical (the farmer watches a progress bar), so it
    # pins the fastest verified flash model — operators override via
    # AI_GEMINI_MODEL_PLAN. (3.5-flash-lite benches ~20s/TTFB on some keys;
    # 3.5-flash benches ~2s.)
    ai_gemini_model_plan: str = "gemini-3.5-flash"
    # Leaf-clinic vision scans are latency-critical (the farmer watches a
    # progress animation), so they pin a flash-class model independent of
    # AI_GEMINI_MODEL — operators override via AI_GEMINI_MODEL_VISION.
    ai_gemini_model_vision: str = "gemini-3.5-flash"
    ai_gemini_model_pro: str = "gemini-2.5-pro"
    ai_gemini_embed_model: str = "gemini-embedding-001"
    ai_daily_budget_usd: float = 50.0
    ai_hash_salt: str = "dev-ai-salt"
    # USD per 1M tokens (published list input rates; operators override with
    # AI_COST_JEV_PER_1M / AI_COST_GEMINI_PER_1M / AI_COST_GEMINI_LITE_PER_1M).
    ai_cost_jev_per_1m: float = 0.042
    ai_cost_gemini_per_1m: float = 0.30
    ai_cost_gemini_lite_per_1m: float = 0.10
    web_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://65.20.92.22:5173",
        "http://65.20.92.22:5174",
        "*",
    ]

    @model_validator(mode="after")
    def _require_real_secrets_outside_dev(self):
        if self.env in ("staging", "prod"):
            missing = []
            if self.jwt_secret in ("", "dev-secret-change-me"):
                missing.append("jwt_secret")
            if not self.razorpay_key_id:
                missing.append("razorpay_key_id")
            if not self.razorpay_key_secret:
                missing.append("razorpay_key_secret")
            if missing:
                raise ValueError(
                    f"refusing to start with env={self.env}: unsafe/missing {', '.join(missing)}"
                )
        return self


settings = Settings()
