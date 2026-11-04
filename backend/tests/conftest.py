"""
Pytest configuration and shared fixtures for O-Finance Backend tests.
"""

import os
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Ensure test environment defaults
os.environ["APP_ENV"] = "test"
os.environ["LOG_LEVEL"] = "WARNING"

from app.main import app
from app.core.config import settings


@pytest.fixture(autouse=True)
def reset_settings_env(monkeypatch):
    """
    Ensure each test runs with predictable test configuration.
    Explicitly clears any live secrets during testing.
    """
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(settings, "database_url", None)


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Asynchronous HTTP test client bound directly to the FastAPI ASGI application.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
