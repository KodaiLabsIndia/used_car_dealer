from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql://arihant:arihant_local_only@127.0.0.1:55438/arihant"
    node_env: str = "development"
    dev_auth_enabled: bool = False
    dev_access_code: str = ""
    media_root: str = ".data/media"
    ai_enabled: bool = False
    ai_url: str = "http://127.0.0.1:11435"
    ai_model: str = "qwen3.5:4b"
    ai_allow_remote: bool = False
    ai_requests_per_day: int = 100

    @property
    def sqlalchemy_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def media_path(self) -> Path:
        return ROOT / self.media_root

    def validate_runtime(self) -> None:
        if self.node_env == "production":
            raise RuntimeError(
                "Production is locked until production identity and release gates are configured."
            )
        if self.dev_auth_enabled and len(self.dev_access_code) < 12:
            raise RuntimeError("Development access code must contain at least 12 characters.")
