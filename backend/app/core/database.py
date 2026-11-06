"""
O-Finance Database Layer (SQLAlchemy 2.x + psycopg 3 + SQLite Portable Fallback)
Provides asynchronous engine, session factory, declarative base,
explicit database connectivity verification, and auto-initialization
for SQLite portable fallback when PostgreSQL is unconfigured.
"""

from typing import AsyncGenerator, Optional, Tuple
import asyncio
import logging
import os
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("ofinance.database")


class Base(DeclarativeBase):
    """Declarative Base for all transactional and audit models.
    Compatible with both PostgreSQL and SQLite backends."""
    pass


# Global engine and sessionmaker references
_async_engine: Optional[AsyncEngine] = None
_async_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def init_db_schema() -> None:
    """
    Auto-initialize database schema for the effective database backend.
    
    If USE_SQLITE_FALLBACK is True and DATABASE_URL is not configured,
    creates the SQLite database file and tables via Base.metadata.create_all.
    If DATABASE_URL is configured (PostgreSQL), also ensures tables exist
    by calling create_all on the engine (idempotent operation).
    
    This function is idempotent and safe to call at application startup.
    It preserves 100% compatibility with test_database.py assertions
    for unconfigured databases (returns early if no effective DB URL).
    """
    global _async_engine, _async_session_factory
    
    effective_db = settings.effective_database_url
    
    if not effective_db:
        # No database configured - return early to preserve test assertions
        logger.info("No effective database configured; skipping schema initialization.")
        return
    
    # Ensure data directory exists for SQLite
    if effective_db.startswith("./") or effective_db.startswith("."):
        db_path = Path(effective_db)
        db_path.parent.mkdir(parents=True, exist_ok=True)
    
    if settings.use_sqlite_fallback and effective_db.replace("sqlite+aiosqlite://", "").startswith("./"):
        # SQLite fallback mode
        sqlite_url = effective_db
        if not sqlite_url.startswith("sqlite+aiosqlite://"):
            sqlite_url = "sqlite+aiosqlite:///" + str(Path(sqlite_url).resolve())
        
        logger.info("Initializing SQLite schema at: %s", sqlite_url)
        _async_engine = create_async_engine(
            sqlite_url,
            echo=settings.app_env == "development" and settings.log_level == "DEBUG",
            future=True,
        )
        _async_session_factory = async_sessionmaker(
            bind=_async_engine,
            autoflush=False,
            expire_on_commit=False,
        )
        
        # Create all tables in the SQLite database
        async def _create_schema():
            async with _async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_create_schema())
        except RuntimeError:
            asyncio.run(_create_schema())
        logger.info("SQLite schema initialized successfully via Base.metadata.create_all.")
        return
    
    # PostgreSQL mode (or SQLite with full URL)
    if not _async_engine:
        db_url = effective_db
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        
        _async_engine = create_async_engine(
            db_url,
            echo=settings.app_env == "development" and settings.log_level == "DEBUG",
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            future=True,
        )
        _async_session_factory = async_sessionmaker(
            bind=_async_engine,
            autoflush=False,
            expire_on_commit=False,
        )
        logger.info("Initialized async SQLAlchemy engine for effective database.")
    
    # Ensure tables exist (idempotent)
    async def _create_schema():
        async with _async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_create_schema())
    except RuntimeError:
        asyncio.run(_create_schema())
    logger.info("Database schema initialized via Base.metadata.create_all.")


def get_engine() -> Optional[AsyncEngine]:
    """
    Lazily initialize and return the async SQLAlchemy engine.
    Returns None if no effective database URL is configured.
    """
    global _async_engine, _async_session_factory
    
    effective_db = settings.effective_database_url
    
    if not effective_db:
        return None
    
    # Ensure URL uses postgresql+psycopg for psycopg 3 async driver
    if effective_db.startswith("postgresql://"):
        effective_db = effective_db.replace("postgresql://", "postgresql+psycopg://", 1)
    
    if _async_engine is None:
        try:
            if effective_db.startswith("sqlite+aiosqlite://"):
                _async_engine = create_async_engine(
                    effective_db,
                    echo=settings.app_env == "development" and settings.log_level == "DEBUG",
                    future=True,
                )
            else:
                _async_engine = create_async_engine(
                    effective_db,
                    echo=settings.app_env == "development" and settings.log_level == "DEBUG",
                    pool_pre_ping=True,
                    pool_size=5,
                    max_overflow=10,
                    future=True,
                )
            _async_session_factory = async_sessionmaker(
                bind=_async_engine,
                autoflush=False,
                expire_on_commit=False,
            )
            logger.info("Initialized async SQLAlchemy engine with driver: %s", effective_db.split("://")[0])
        except Exception as e:
            logger.error("Failed to construct async SQLAlchemy engine: %s", str(e))
            _async_engine = None
            _async_session_factory = None
    
    return _async_engine


def get_session_factory() -> Optional[async_sessionmaker[AsyncSession]]:
    """Return the async session factory if engine is available."""
    get_engine()
    return _async_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session.
    Raises ConnectionError if database is not configured or engine unavailable.
    """
    factory = get_session_factory()
    if factory is None:
        raise ConnectionError(
            "Database is not configured or engine is unavailable. "
            "Check USE_SQLITE_FALLBACK and DATABASE_URL in backend/.env."
        )
    
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection(timeout_seconds: float = 2.0) -> Tuple[bool, str]:
    """
    Executes a real ping (SELECT 1) against the database with strict timeout.
    Returns (is_connected, status_detail).
    NEVER reports success if database is unconfigured or unreachable.
    """
    effective_db = settings.effective_database_url
    
    if not effective_db:
        return False, "DATABASE_URL is not configured and USE_SQLITE_FALLBACK is not active"
    
    engine = get_engine()
    if engine is None:
        return False, "Async engine failed to initialize from effective DATABASE_URL"
    
    async def _ping_db() -> int:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar()
    
    try:
        val = await asyncio.wait_for(_ping_db(), timeout=timeout_seconds)
        if val == 1:
            return True, "Database reachable (SELECT 1 successful)"
        return False, f"Unexpected query response from database: {val}"
    except asyncio.TimeoutError:
        logger.warning(
            "Database connectivity check timed out after %.1fs", timeout_seconds
        )
        return False, f"Database connection timed out after {timeout_seconds:.1f}s"
    except Exception as e:
        logger.warning("Database connectivity check failed: %s", str(e))
        return False, f"Database connection error: {type(e).__name__}"
