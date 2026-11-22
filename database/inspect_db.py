"""Read-only database overview suitable for a laboratory report screenshot."""

from sqlalchemy import func, inspect, select, text

from database.config import make_engine
from database.models import Base


def main() -> None:
    engine = make_engine()
    try:
        with engine.connect() as connection:
            row = connection.execute(text(
                "SELECT current_database(), current_user, current_setting('server_version')"
            )).one()
            print(f"Database: {row[0]} | User: {row[1]} | PostgreSQL: {row[2]}")
            inspector = inspect(connection)
            tables = set(inspector.get_table_names(schema="public"))
            if "alembic_version" not in tables:
                raise SystemExit("No migrations applied yet. Run: python -m alembic upgrade head")
            revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
            print(f"Alembic revision: {revision}")
            print("\nApplication tables:")
            for name, table in sorted(Base.metadata.tables.items()):
                if name not in tables:
                    raise SystemExit(f"Missing table: {name}")
                count = connection.scalar(select(func.count()).select_from(table))
                print(f"  {name:20} {count:3} rows")
            print("\nRole permissions:")
            matrix = connection.execute(text("""
                SELECT r.name, string_agg(p.code, ', ' ORDER BY p.code) AS permissions
                FROM roles AS r
                LEFT JOIN role_permissions AS rp ON rp.role_id = r.id
                LEFT JOIN permissions AS p ON p.id = rp.permission_id
                GROUP BY r.id, r.name
                ORDER BY CASE r.name WHEN 'user' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, r.name
            """))
            for name, permissions in matrix:
                print(f"  {name:12} {permissions or '(none)'}")
            print("\nInspection completed. No records were changed.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
