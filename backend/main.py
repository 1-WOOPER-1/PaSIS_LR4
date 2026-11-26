import logging
import os
from contextlib import asynccontextmanager

from argon2 import PasswordHasher
from argon2.low_level import Type
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.dialects.postgresql import insert
from database.queries import permission_codes_for_user
from backend.schemas import LoginRequest, RegistrationRequest
from database.config import make_engine
from database.models import Role, User, user_roles
from datetime import datetime, timedelta, timezone

import jwt
from argon2.exceptions import InvalidHashError, VerificationError
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = make_engine()
    app.state.engine = engine

    try:
        hash_scheme = os.getenv("HASH_SCHEME", "argon2id")
        if hash_scheme != "argon2id":
            raise RuntimeError("Установите HASH_SCHEME=argon2id в .env.")

        app.state.password_hasher = PasswordHasher(
            time_cost=int(os.getenv("ARGON2_TIME_COST", "3")),
            memory_cost=int(os.getenv("ARGON2_MEMORY_COST", "65536")),
            parallelism=int(os.getenv("ARGON2_PARALLELISM", "2")),
            type=Type.ID,
        )
        secret_key = os.getenv("SECRET_KEY", "")
        if len(secret_key.encode("utf-8")) < 32:
            raise RuntimeError("Установите случайный SECRET_KEY длиной от 32 байт.")
        app.state.secret_key = secret_key
        yield
    finally:
        engine.dispose()


app = FastAPI(title="PaSIS LR4", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/db")
def database_health(request: Request):
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="База данных недоступна.",
        ) from None

    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    logger.info('{"event":"request_validation_failed"}')
    detail = []

    for error in exc.errors():
        field = error["loc"][-1]
        if field not in {"login", "password"}:
            field = "body"

        message = "Проверьте формат запроса и заполните обязательные поля."
        if error["type"] == "value_error":
            message = error["msg"]

        detail.append({"field": field, "message": message})

    return JSONResponse(status_code=422, content={"detail": detail})


@app.post("/api/register", status_code=201)
def register(data: RegistrationRequest, request: Request):
    engine = request.app.state.engine
    hasher = request.app.state.password_hasher
    password_hash = hasher.hash(data.password.get_secret_value())

    try:
        with Session(engine) as session, session.begin():
            role = session.scalar(select(Role).where(Role.name == "user"))
            if role is None:
                logger.error('{"event":"default_role_missing"}')
                raise HTTPException(500, "Роль для регистрации не настроена.")

            user = User(login=data.login, password_hash=password_hash)
            user.roles.append(role)
            session.add(user)

    except IntegrityError as exc:
        diagnostics = getattr(exc.orig, "diag", None)
        constraint_name = getattr(diagnostics, "constraint_name", None)

        if constraint_name == "uq_users_login":
            logger.info('{"event":"registration_login_conflict"}')
            raise HTTPException(409, "Логин уже занят.") from None

        logger.error('{"event":"registration_integrity_error"}')
        raise HTTPException(500, "Не удалось сохранить пользователя.") from None

    except SQLAlchemyError:
        logger.error('{"event":"registration_database_error"}')
        raise HTTPException(500, "Ошибка базы данных.") from None

    logger.info('{"event":"registration_succeeded"}')
    return {"message": "Пользователь создан."}

@app.post("/api/login")
def login(data: LoginRequest, request: Request):
    engine = request.app.state.engine
    hasher = request.app.state.password_hasher

    with Session(engine) as session:
        user = session.scalar(select(User).where(User.login == data.login))

        if user is None:
            raise HTTPException(401, "Неверный логин или пароль.")

        user_id = user.id
        password_hash = user.password_hash

    try:
        hasher.verify(password_hash, data.password.get_secret_value())
    except (InvalidHashError, VerificationError):
        raise HTTPException(401, "Неверный логин или пароль.") from None

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    access_token = jwt.encode(
        {"sub": str(user_id), "exp": expires_at},
        request.app.state.secret_key,
        algorithm="HS256",
    )

    return {"access_token": access_token, "token_type": "bearer"}

bearer = HTTPBearer(auto_error=False)

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> int:
    unauthorized = HTTPException(
        status_code=401,
        detail="Требуется действующий токен.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        claims = jwt.decode(
            credentials.credentials,
            request.app.state.secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise unauthorized from None

    if not 0 < user_id <= 2**63 - 1:
        raise unauthorized

    return user_id


@app.get("/api/me")
def read_my_profile(
    request: Request,
    user_id: int = Depends(get_current_user),
):
    with Session(request.app.state.engine) as session:
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Требуется действующий токен.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        permissions = permission_codes_for_user(session, user.id)
        if "profile.read" not in permissions:
            raise HTTPException(403, "Недостаточно прав для просмотра профиля.")

        return {
            "id": user.id,
            "login": user.login,
            "roles": sorted(role.name for role in user.roles),
            "permissions": sorted(permissions),
        }

@app.get("/api/users")
def list_users(
    request: Request,
    user_id: int = Depends(get_current_user),
):
    with Session(request.app.state.engine) as session:
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Требуется действующий токен.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        permissions = permission_codes_for_user(session, user.id)
        if "users.read" not in permissions:
            raise HTTPException(
                status_code=403,
                detail="Недостаточно прав для просмотра списка пользователей.",
            )

        rows = session.execute(
            select(User.id, User.login).order_by(User.id)
        )

        return [
            {"id": row.id, "login": row.login}
            for row in rows
        ]

@app.put("/api/users/{target_user_id}/roles/{role_name}", status_code=204)
def grant_role(
    target_user_id: int,
    role_name: str,
    request: Request,
    user_id: int = Depends(get_current_user),
):
    with Session(request.app.state.engine) as session, session.begin():
        caller = session.get(User, user_id)
        if caller is None:
            raise HTTPException(
                status_code=401,
                detail="Требуется действующий токен.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        permissions = permission_codes_for_user(session, caller.id)
        if "roles.manage" not in permissions:
            raise HTTPException(403, "Недостаточно прав для назначения ролей.")

        if not 0 < target_user_id <= 2**63 - 1:
            raise HTTPException(404, "Пользователь не найден.")

        target_user = session.get(User, target_user_id)
        if target_user is None:
            raise HTTPException(404, "Пользователь не найден.")

        role_id = session.scalar(
            select(Role.id).where(Role.name == role_name)
        )
        if role_id is None:
            raise HTTPException(404, "Роль не найдена.")

        statement = (
            insert(user_roles)
            .values(user_id=target_user.id, role_id=role_id)
            .on_conflict_do_nothing(
                index_elements=[user_roles.c.user_id, user_roles.c.role_id]
            )
        )
        session.execute(statement)
