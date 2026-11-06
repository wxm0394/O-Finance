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

    # Dual-Engine Database Fallback Configuration
    use_sqlite_fallback: bool = Field(
        default=False,
        alias="USE_SQLITE_FALLBACK",
    )
    sqlite_db_path: str = Field(
        default="./data/ofinance.db",
        alias="SQLITE_DB_PATH",
    )

    # AI Model Provider Configuration
    llm_provider: str = Field(
        default="openai_compatible",
        alias="LLM_PROVIDER",
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        alias="LLM_BASE_URL",
    )
    llm_api_key: Optional[str] = Field(
        default=None,
        alias="LLM_API_KEY",
    )
    llm_model: Optional[str] = Field(
        default=None,
        alias="LLM_MODEL",
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
        default="ledger/main.beancount",
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
    def active_api_key(self) -> str:
        """Returns llm_api_key if set, fallback to gemini_api_key, or empty string."""
        if self.llm_api_key and self.llm_api_key.strip():
            return self.llm_api_key.strip()
        if self.gemini_api_key and self.gemini_api_key.strip():
            return self.gemini_api_key.strip()
        return ""

    @property
    def active_model(self) -> str:
        """Returns llm_model if set, fallback to gemini_model or ollama_model."""
        if self.llm_model and self.llm_model.strip():
            return self.llm_model.strip()
        prov = (self.llm_provider or "").lower()
        if "ollama" in prov:
            return self.ollama_model
        return self.gemini_model

    @property
    def active_base_url(self) -> str:
        """Returns effective base URL depending on provider setting."""
        prov = (self.llm_provider or "").lower()
        if "ollama" in prov:
            return self.ollama_base_url
        if prov == "gemini":
            return "https://generativelanguage.googleapis.com"
        return self.llm_base_url or "https://api.openai.com/v1"

    @property
    def is_gemini_key_configured(self) -> bool:
        """
        Returns True ONLY if active API key or GEMINI_API_KEY is non-empty.
        Does NOT imply model verification.
        """
        return bool(self.active_api_key)

    @property
    def is_database_configured(self) -> bool:
        """
        Returns True ONLY if DATABASE_URL is non-empty.
        """
        return bool(self.database_url and len(self.database_url.strip()) > 0)

    @property
    def effective_database_url(self) -> str:
        """
        Returns the effective database URL based on configuration.
        If USE_SQLITE_FALLBACK is True and DATABASE_URL is not configured,
        returns the SQLite database URL (sqlite+aiosqlite:///...). Otherwise returns DATABASE_URL.
        """
        if self.use_sqlite_fallback and (not self.database_url or not self.database_url.strip()):
            path = self.sqlite_db_path
            if not path.startswith("sqlite"):
                return f"sqlite+aiosqlite:///{path}"
            return path
        return self.database_url or ""


# Global cached settings instance
settings = Settings()
