"""Integration tests against a separate PostgreSQL database with migrations applied."""

import io
import os
import uuid

import pytest
from dotenv import dotenv_values
from sqlalchemy import URL, create_engine, delete, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.configure import quote_env
from database.models import Permission, Role, User, role_permissions, user_roles
from database.queries import permission_codes_for_user

# Valid Argon2id hash of a synthetic test-only password. It is never seeded.
TEST_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$7xDb3bgTs3GP0XqMaNPlNw$"
    "csPi7ekhl12cKFAoUh0fRIgi2dAnZyd35L2SM89Fro4"
)


@pytest.fixture(scope="module")
def engine():
    value = os.getenv("TEST_DATABASE_URL")
    if not value:
        raise pytest.UsageError("Set TEST_DATABASE_URL to a separate migrated PostgreSQL database.")
    url = make_url(value)
    if url.drivername != "postgresql+psycopg" or not (url.database or "").endswith("_test"):
        raise pytest.UsageError("TEST_DATABASE_URL must point to PostgreSQL and a database ending in _test.")
    instance = create_engine(url, echo=False, hide_parameters=True)
    yield instance
    instance.dispose()


@pytest.fixture
def session(engine):
    with engine.connect() as connection:
        outer_transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as instance:
            yield instance
        if outer_transaction.is_active:
            outer_transaction.rollback()


def create_user(session, role_names=()):
    user = User(login="test_" + uuid.uuid4().hex[:20], password_hash=TEST_HASH)
    user.roles = list(session.scalars(select(Role).where(Role.name.in_(role_names))))
    session.add(user)
    session.flush()
    return user


def test_user_insert_creates_id_and_timestamp(session):
    user = create_user(session, ["user"])
    assert user.id > 0
    assert user.created_at.tzinfo is not None
    assert user.password_hash == TEST_HASH


def test_duplicate_login_rejected_by_database(session):
    user = create_user(session)
    with pytest.raises(IntegrityError) as caught:
        with session.begin_nested():
            session.add(User(login=user.login, password_hash=TEST_HASH))
            session.flush()
    assert caught.value.orig.sqlstate == "23505"
    assert caught.value.orig.diag.constraint_name == "uq_users_login"


@pytest.mark.parametrize("login", ["ab", "with space", "пользователь", "bad@login"])
def test_invalid_login_rejected_by_database(session, login):
    with pytest.raises(IntegrityError) as caught:
        with session.begin_nested():
            session.add(User(login=login, password_hash=TEST_HASH))
            session.flush()
    assert caught.value.orig.diag.constraint_name == "ck_users_login_format"


def test_empty_password_hash_rejected(session):
    with pytest.raises(IntegrityError) as caught:
        with session.begin_nested():
            session.add(User(login="empty_" + uuid.uuid4().hex[:16], password_hash=""))
            session.flush()
    assert caught.value.orig.diag.constraint_name == "ck_users_password_hash_not_empty"


@pytest.mark.parametrize("role,expected", [
    ("user", {"profile.read"}),
    ("moderator", {"profile.read", "users.read"}),
    ("admin", {"profile.read", "users.read", "users.manage", "roles.manage"}),
])
def test_each_role_has_exact_permissions(session, role, expected):
    user = create_user(session, [role])
    assert permission_codes_for_user(session, user.id) == expected


def test_user_has_allowed_permission_and_lacks_admin_permission(session):
    user = create_user(session, ["user"])
    permissions = permission_codes_for_user(session, user.id)
    assert "profile.read" in permissions
    assert "roles.manage" not in permissions


def test_multiple_roles_form_union_without_duplicates(session):
    user = create_user(session, ["user", "moderator"])
    assert len(user.roles) == 2
    assert permission_codes_for_user(session, user.id) == {"profile.read", "users.read"}


def test_no_role_and_missing_user_have_no_permissions(session):
    user = create_user(session)
    assert permission_codes_for_user(session, user.id) == set()
    assert permission_codes_for_user(session, 0) == set()


def test_revoking_role_removes_its_permissions(session):
    user = create_user(session, ["user", "moderator"])
    moderator = session.scalar(select(Role).where(Role.name == "moderator"))
    session.execute(delete(user_roles).where(
        user_roles.c.user_id == user.id, user_roles.c.role_id == moderator.id
    ))
    assert permission_codes_for_user(session, user.id) == {"profile.read"}


def test_duplicate_role_assignment_rejected(session):
    user = create_user(session, ["user"])
    role_id = user.roles[0].id
    with pytest.raises(IntegrityError) as caught:
        with session.begin_nested():
            session.execute(user_roles.insert().values(user_id=user.id, role_id=role_id))
    assert caught.value.orig.sqlstate == "23505"


def test_assignment_to_missing_role_rejected(session):
    user = create_user(session)
    with pytest.raises(IntegrityError) as caught:
        with session.begin_nested():
            session.execute(user_roles.insert().values(user_id=user.id, role_id=0))
    assert caught.value.orig.sqlstate == "23503"


@pytest.mark.parametrize("load_roles", [False, True])
def test_delete_user_cascades_associations_and_keeps_roles(session, load_roles):
    user = create_user(session, ["user", "moderator"])
    user_id = user.id
    session.expire(user, ["roles"])
    if load_roles:
        assert len(user.roles) == 2
    role_count = session.scalar(select(func.count()).select_from(Role))
    session.delete(user)
    session.flush()
    assert session.scalar(select(func.count()).select_from(user_roles).where(
        user_roles.c.user_id == user_id
    )) == 0
    assert session.scalar(select(func.count()).select_from(Role)) == role_count


def test_delete_role_preserves_users_and_permissions(session):
    user = create_user(session, ["moderator"])
    moderator = session.scalar(select(Role).where(Role.name == "moderator"))
    role_id = moderator.id
    permission_count = session.scalar(select(func.count()).select_from(Permission))
    session.delete(moderator)
    session.flush()
    assert session.get(User, user.id) is not None
    assert permission_codes_for_user(session, user.id) == set()
    assert session.scalar(select(func.count()).select_from(role_permissions).where(
        role_permissions.c.role_id == role_id
    )) == 0
    assert session.scalar(select(func.count()).select_from(Permission)) == permission_count


@pytest.mark.parametrize("password", ["plain-Example7!", "a@b:c/d?#%", "a'b\\c$HOME", '${secret}" spaced'])
def test_special_password_survives_url_and_dotenv_serialization(password):
    url = URL.create("postgresql+psycopg", username="tester", password=password, host="localhost", database="test")
    rendered = url.render_as_string(hide_password=False)
    source = "DATABASE_URL=" + quote_env(rendered) + "\nPASSWORD=" + quote_env(password) + "\n"
    parsed = dotenv_values(stream=io.StringIO(source), interpolate=False)
    assert parsed["PASSWORD"] == password
    assert make_url(parsed["DATABASE_URL"]).password == password
