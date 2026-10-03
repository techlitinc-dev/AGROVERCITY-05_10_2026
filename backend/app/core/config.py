from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "AGROVERCITY API"
    env: str = Field(default="dev", validation_alias=AliasChoices("APP_ENV", "ENV"))
    firebase_service_account_path: str = "secrets/firebase-service-account.json"
    firebase_project_id: str = "agrovercity-dev"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60 * 24
    jwt_refresh_ttl_days: int = 30
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    bank_verify_provider: str = "stub"
    escrow_dispute_window_hours: int = 24
    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    weather_api_key: str = ""
    sentry_dsn: str = ""
    cron_secret: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    ai_provider: str = "shim"
    ai_jev_model: str = "typesafe/jev-1.13"
    ai_gemini_model: str = "gemini-2.5-flash"
    ai_gemini_model_lite: str = "gemini-2.5-flash-lite"
    ai_gemini_model_pro: str = "gemini-2.5-pro"
    ai_gemini_embed_model: str = "gemini-embedding-001"
    ai_daily_budget_usd: float = 50.0
    ai_hash_salt: str = "dev-ai-salt"
    web_origins: list[str] = ["http://localhost:5173"]

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
