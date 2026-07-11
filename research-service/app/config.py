"""Konfiguration aus Umgebungsvariablen via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Zentrale Konfiguration des Research-Microservice."""

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    api_key: str = ""

    scrape_timeout: int = 10
    social_timeout: int = 15
    llm_timeout: int = 30
    max_subpages: int = 8

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
