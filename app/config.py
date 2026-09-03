"""Runtime settings. Secrets come from .env.local (git-ignored) or the host's env."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", ".env.local"), extra="ignore")

    anthropic_api_key: str | None = None
    # The plan's hard latency budget, in milliseconds.
    verdict_budget_ms: int = 5000
    # Server-side concurrency cap for batch processing (docs/build-plan.md §02).
    batch_concurrency: int = 8


settings = Settings()
