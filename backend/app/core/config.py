"""
O-Finance Core Application Configuration
Built with pydantic-settings for strict environment variable parsing,
type validation, and secrets isolation.
"""

from typing import List, Literal, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central settings for O-Finance Python FastAPI backend.
    Enforces strict security boundary: Secrets are never returned to clients
    or written to log output.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application Runtime
    app_env: Literal["development", "production", "test"] = Field(
        default="development",
        alias="APP_ENV",
    )
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # CORS
    cors_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    # Database (SQLAlchemy 2.x + psycopg 3)
    # Default to an explicit empty string when unconfigured
    database_url: Optional[str] = Field(
        default=None,
        alias="DATABASE_URL",
    )

    # AI Model Provider Configuration
    # Phase 1: Gemini is sole cloud model; Local Ollama is optional local mode
    llm_provider: Literal["Gemini", "Local Ollama"] = Field(
        default="Gemini",
        alias="LLM_PROVIDER",
    )
    gemini_model: str = Field(
        default="gemini-2.5-pro",
        alias="GEMINI_MODEL",
    )
    gemini_api_key: Optional[str] = Field(
        default=None,
        alias="GEMINI_API_KEY",
    )
    ollama_base_url: str = Field(
        default="http://127.0.0.1:11434",
        alias="OLLAMA_BASE_URL",
    )
    ollama_model: str = Field(
        default="deepseek-r1:8b",
        alias="OLLAMA_MODEL",
    )

    # Budgets & Limits
    assistant_daily_budget_usd: float = Field(
        default=25.0,
        alias="ASSISTANT_DAILY_BUDGET_USD",
    )
    assistant_max_steps_per_run: int = Field(
        default=8,
        alias="ASSISTANT_MAX_STEPS_PER_RUN",
    )

    # External Paths & Connectors
    beancount_file_path: str = Field(
        default="~/o-finance/ledger/main.beancount",
        alias="BEANCOUNT_FILE_PATH",
    )
    fava_server_url: str = Field(
        default="http://127.0.0.1:5000",
        alias="FAVA_SERVER_URL",
    )
    daily_analysis_api_url: str = Field(
        default="http://127.0.0.1:8090/api/v1/reports",
        alias="DAILY_ANALYSIS_API_URL",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def is_gemini_key_configured(self) -> bool:
        """
        Returns True ONLY if GEMINI_API_KEY is non-empty.
        Does NOT imply model verification.
        """
        return bool(self.gemini_api_key and len(self.gemini_api_key.strip()) > 5)

    @property
    def is_database_configured(self) -> bool:
        """
        Returns True ONLY if DATABASE_URL is non-empty.
        """
        return bool(self.database_url and len(self.database_url.strip()) > 0)


# Global cached settings instance
settings = Settings()
