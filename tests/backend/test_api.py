from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from backend.main import app
from database.config import get_database_url
from database.models import Role, User


TEST_PASSWORD = "TestPass42!"


@pytest.fixture
def client(monkeypatch):
    test_url = make_url(get_database_url()).set(database="pasis_api_test")
    monkeypatch.setenv(
        "DATABASE_URL",
        test_url.render_as_string(hide_password=False),
    )

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def new_login(client):
    logins = []

    def generate():
        login = f"test_{uuid4().hex[:20]}"
        logins.append(login)
        return login

    yield generate

    with Session(client.app.state.engine) as session, session.begin():
        session.execute(delete(User).where(User.login.in_(logins)))


def register(client, login, password=TEST_PASSWORD):
    return client.post(
        "/api/register",
        json={"login": login, "password": password},
    )


def auth_headers(client, login):
    response = client.post(
        "/api/login",
        json={"login": login, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_creates_user_with_argon2id_hash(client, new_login):
    login = new_login()

    response = register(client, login)

    assert response.status_code == 201

    with Session(client.app.state.engine) as session:
        user = session.scalar(select(User).where(User.login == login))
        assert user is not None
        assert user.password_hash.startswith("$argon2id$")
        assert PasswordHasher().verify(user.password_hash, TEST_PASSWORD)
        assert [role.name for role in user.roles] == ["user"]


def test_register_rejects_duplicate_login(client, new_login):
    login = new_login()
    assert register(client, login).status_code == 201

    response = register(client, login)

    assert response.status_code == 409
    assert response.json()["detail"] == "Логин уже занят."


def test_register_rejects_weak_password(client, new_login):
    weak_password = "weakpass"

    response = register(client, new_login(), weak_password)

    assert response.status_code == 422
    assert response.json()["detail"][0]["field"] == "password"
    assert weak_password not in response.text


def test_user_cannot_list_users(client, new_login):
    login = new_login()
    assert register(client, login).status_code == 201

    response = client.get("/api/users", headers=auth_headers(client, login))

    assert response.status_code == 403


def test_admin_grants_moderator_access(client, new_login):
    admin_login = new_login()
    member_login = new_login()
    assert register(client, admin_login).status_code == 201
    assert register(client, member_login).status_code == 201

    with Session(client.app.state.engine) as session, session.begin():
        admin = session.scalar(select(User).where(User.login == admin_login))
        admin_role = session.scalar(select(Role).where(Role.name == "admin"))
        assert admin is not None
        assert admin_role is not None
        admin.roles.append(admin_role)

    member_headers = auth_headers(client, member_login)
    profile = client.get("/api/me", headers=member_headers)
    assert profile.status_code == 200
    member_id = profile.json()["id"]
    assert client.get("/api/users", headers=member_headers).status_code == 403

    grant = client.put(
        f"/api/users/{member_id}/roles/moderator",
        headers=auth_headers(client, admin_login),
    )
    assert grant.status_code == 204

    response = client.get("/api/users", headers=member_headers)
    assert response.status_code == 200
    assert {"id": member_id, "login": member_login} in response.json()
