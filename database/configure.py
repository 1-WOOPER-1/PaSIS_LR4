"""Create an ignored local .env file using an interactive password prompt."""

import argparse
import getpass
import os
import secrets

from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from database.config import PROJECT_ROOT


def quote_env(value: str) -> str:
    """Quote a literal dotenv value, including apostrophes and backslashes."""
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="pasis_user")
    parser.add_argument("--database", default="pasis_db")
    args = parser.parse_args()

    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        raise SystemExit("A local .env already exists. It has not been overwritten.")

    password = getpass.getpass(f"PostgreSQL password for {args.user}: ")
    if not password or any(ch in password for ch in "\r\n\0"):
        raise SystemExit("Enter a non-empty password without line breaks.")

    url = URL.create(
        "postgresql+psycopg",
        username=args.user,
        password=password,
        host=args.host,
        port=args.port,
        database=args.database,
    )
    engine = create_engine(url, echo=False, hide_parameters=True, connect_args={"connect_timeout": 10})
    try:
        with engine.connect() as connection:
            row = connection.execute(text("SELECT current_database(), current_user")).one()
    except SQLAlchemyError:
        raise SystemExit(
            "Connection failed. Check the PostgreSQL service, host, port, database, user and password. "
            "The .env file was not created."
        ) from None
    finally:
        engine.dispose()

    settings = {
        "DATABASE_URL": url.render_as_string(hide_password=False),
        "POSTGRES_DB": args.database,
        "POSTGRES_USER": args.user,
        "POSTGRES_PASSWORD": password,
        "HASH_SCHEME": "argon2id",
        "ARGON2_TIME_COST": "3",
        "ARGON2_MEMORY_COST": "65536",
        "ARGON2_PARALLELISM": "2",
        "SECRET_KEY": secrets.token_urlsafe(32),
        "APP_ENV": "development",
        "PORT": "8000",
    }
    contents = "# Local settings. Do not commit this file.\n"
    contents += "\n".join(f"{key}={quote_env(value)}" for key, value in settings.items()) + "\n"
    # Exclusive creation also prevents overwriting a file created concurrently.
    descriptor = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(contents)
    print(f"Connected. Database: {row[0]}; user: {row[1]}.")
    print("Created local .env. Credentials were not printed.")


if __name__ == "__main__":
    main()
