"""Read configuration without printing credentials or creating a connection."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def get_database_url() -> str:
    # Environment variables take priority (important for future Docker services).
    # Literal passwords containing ${...} must not be expanded by python-dotenv.
    load_dotenv(PROJECT_ROOT / ".env", override=False, interpolate=False)
    value = os.getenv("DATABASE_URL", "")
    if not value:
        raise RuntimeError("DATABASE_URL is missing. Run: python -m database.configure")
    try:
        parsed = make_url(value)
    except Exception:
        raise RuntimeError("DATABASE_URL has an invalid format.") from None
    if parsed.drivername != "postgresql+psycopg":
        raise RuntimeError("DATABASE_URL must use the postgresql+psycopg driver.")
    if parsed.password == "CHANGE_ME":
        raise RuntimeError("Configure a local database password before connecting.")
    return value


def make_engine() -> Engine:
    return create_engine(
        get_database_url(),
        pool_pre_ping=True,
        echo=False,
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )
