"""Prepare local Docker credentials without requiring a running PostgreSQL server."""

import os
import re
import secrets

from dotenv import dotenv_values, set_key
from sqlalchemy import URL
from sqlalchemy.engine import make_url

from database.config import PROJECT_ROOT


def main() -> None:
    env_path = PROJECT_ROOT / ".env"
    source = env_path if env_path.exists() else PROJECT_ROOT / ".env.example"
    values = dotenv_values(source, interpolate=False)
    user = values.get("POSTGRES_USER") or "pasis_user"
    database = values.get("POSTGRES_DB") or "pasis_db"
    for label, value in [("POSTGRES_USER", user), ("POSTGRES_DB", database)]:
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,31}", value):
            raise SystemExit(f"{label} must use 1-32 lowercase letters, digits or underscores.")
    if user == "postgres" or database in {"postgres", "template0", "template1"}:
        raise SystemExit("Use separate application user and database names.")

    port = values.get("DB_HOST_PORT") or "5433"
    try:
        if not 1 <= int(port) <= 65535:
            raise ValueError
    except ValueError:
        raise SystemExit("DB_HOST_PORT must be a port number from 1 to 65535.") from None

    admin_secret = values.get("POSTGRES_ADMIN_PASSWORD")
    create_admin_secret = not admin_secret or admin_secret == "CHANGE_ME"
    if create_admin_secret:
        admin_secret = secrets.token_urlsafe(32)
    app_secret = values.get("POSTGRES_DOCKER_PASSWORD")
    create_app_secret = not app_secret or app_secret == "CHANGE_ME"
    if create_app_secret:
        app_secret = secrets.token_urlsafe(32)

    url = URL.create(
        "postgresql+psycopg", username=user, password=app_secret,
        host="db", port=5432, database=database,
    )
    additions = {
        "POSTGRES_DB": database,
        "POSTGRES_USER": user,
        "DOCKER_DATABASE_URL": url.render_as_string(hide_password=False),
        "DB_HOST_PORT": port,
    }
    if create_admin_secret:
        additions["POSTGRES_ADMIN_PASSWORD"] = admin_secret
    if create_app_secret:
        additions["POSTGRES_DOCKER_PASSWORD"] = app_secret
    local_url = values.get("DATABASE_URL") or ""
    try:
        local_needs_configuration = not local_url or make_url(local_url).password == "CHANGE_ME"
    except Exception:
        raise SystemExit("Existing DATABASE_URL has an invalid format. It was not overwritten.") from None
    if local_needs_configuration:
        additions["DATABASE_URL"] = url.set(host="127.0.0.1", port=int(port)).render_as_string(hide_password=False)
        additions["POSTGRES_PASSWORD"] = app_secret
    if not values.get("SECRET_KEY") or values["SECRET_KEY"] == "CHANGE_ME":
        additions["SECRET_KEY"] = secrets.token_urlsafe(32)

    if not env_path.exists():
        descriptor = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write((PROJECT_ROOT / ".env.example").read_text(encoding="utf-8"))
    for key, value in additions.items():
        set_key(str(env_path), key, value, quote_mode="always")

    print(f"Docker configuration ready. Database: {database}; user: {user}; host port: {port}.")
    print("Docker credentials are stored in local .env and were not printed.")
    print("Next: docker compose up --build")


if __name__ == "__main__":
    main()
