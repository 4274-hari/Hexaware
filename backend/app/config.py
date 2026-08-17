from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "citizen_call_intelligence"
    exotel_account_sid: str = ""
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_phone_number: str = ""
    exotel_api_base: str = "https://api.in.exotel.com"
    exotel_dlt_template_id: str = ""
    public_base_url: str = "http://localhost:8000"
    stt_provider: str = "local"
    stt_language: str = ""
    stt_model_size: str = "base"
    groq_api_key: str = ""
    telephony_mode: str = "simulation"
    jwt_secret: str = "replace-this-development-secret"
    head_username: str = "head"
    head_password: str = "ChangeMeHead123!"
    department_username: str = "officer"
    department_password: str = "ChangeMeOfficer123!"
    department_default: str = "Municipal Corporation & Sanitation"
    department_accounts_json: str = ""
    simulator_username: str = "simulator"
    simulator_password: str = "ChangeMeSimulator123!"


settings = Settings()
