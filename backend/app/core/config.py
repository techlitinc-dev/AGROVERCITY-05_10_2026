from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "AGROVERCITY API"
    env: str = "dev"
    firebase_service_account_path: str = "secrets/firebase-service-account.json"
    firebase_project_id: str = "agrovercity-dev"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60 * 24
    jwt_refresh_ttl_days: int = 30
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    weather_api_key: str = ""
    sentry_dsn: str = ""


settings = Settings()
