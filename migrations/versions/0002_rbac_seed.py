"""Insert the initial roles, permissions and their seven associations."""

from alembic import op
import sqlalchemy as sa

revision = "0002_rbac_seed"
down_revision = "0001_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    roles = sa.table("roles", sa.column("name", sa.String), sa.column("description", sa.String))
    permissions = sa.table("permissions", sa.column("code", sa.String), sa.column("description", sa.String))
    op.bulk_insert(roles, [
        {"name": "user", "description": "View own profile"},
        {"name": "moderator", "description": "View own profile and user directory"},
        {"name": "admin", "description": "Manage users and role assignments"},
    ])
    op.bulk_insert(permissions, [
        {"code": "profile.read", "description": "Read the authenticated user's own profile"},
        {"code": "users.read", "description": "Read the user directory without password hashes"},
        {"code": "users.manage", "description": "Manage user accounts"},
        {"code": "roles.manage", "description": "Assign and revoke application roles"},
    ])
    op.execute(sa.text("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles AS r
        CROSS JOIN permissions AS p
        WHERE (r.name = 'user' AND p.code = 'profile.read')
           OR (r.name = 'moderator' AND p.code IN ('profile.read', 'users.read'))
           OR (r.name = 'admin' AND p.code IN (
               'profile.read', 'users.read', 'users.manage', 'roles.manage'
           ))
    """))


def downgrade() -> None:
    # Cascades remove only associations, never users. Downgrading removes seeded roles.
    op.execute(sa.text("DELETE FROM roles WHERE name IN ('user', 'moderator', 'admin')"))
    op.execute(sa.text("DELETE FROM permissions WHERE code IN ('profile.read', 'users.read', 'users.manage', 'roles.manage')"))
