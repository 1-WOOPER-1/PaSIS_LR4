"""Read effective permissions for a trusted user ID supplied by the backend."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import Permission, role_permissions, user_roles


def permission_codes_for_user(session: Session, user_id: int) -> set[str]:
    statement = (
        select(Permission.code)
        .join(role_permissions, role_permissions.c.permission_id == Permission.id)
        .join(user_roles, user_roles.c.role_id == role_permissions.c.role_id)
        .where(user_roles.c.user_id == user_id)
        .distinct()
    )
    return set(session.scalars(statement))
