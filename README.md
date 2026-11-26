# ПАСЗИ: лабораторная работа 4, вариант 3

Регистрация пользователя и ролевая модель разграничения доступа (RBAC).

Репозиторий состоит из следующих основных компонентов:
-  **database**: PostgreSQL, пять таблиц, модели SQLAlchemy, миграции Alembic, роли и права, запрос получения прав пользователя, 23 проверки БД и конфигурация Docker для PostgreSQL и запуска миграций.
- **backend**: реализует HTTP API регистрации, входа и проверки прав.

## Запуск базы данных локально

Подробная инструкция: [database/README.md](database/README.md).
Для подготовленных PostgreSQL, базы `pasis_db` и пользователя `pasis_user`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-db.txt
.\.venv\Scripts\python.exe -m database.configure
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m database.inspect_db
```

Уже созданное окружение и настроенный `.env` используются повторно.

## Запуск компонента БД через Docker

Требуются Docker с Compose и Python >=3.11 для первоначальной подготовки `.env`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-db.txt
.\.venv\Scripts\python.exe -m database.configure_docker
docker compose up --build
```

После однократной настройки `.env` запуск выполняется командой `docker compose up`.
Для применения изменений в коде команда `docker compose up --build`.

- `db`: PostgreSQL 18, отдельный том данных, порт хоста `127.0.0.1:5433` по умолчанию.
- `db_migrate`: ожидает готовности PostgreSQL, применяет миграции и завершается с кодом 0.
- Учётная запись приложения владеет своей базой, но не имеет SUPERUSER, CREATEDB и CREATEROLE.
- Пароли контейнерной БД генерируются отдельно от пароля локального PostgreSQL.
- Повторная подготовка `.env` сохраняет уже сгенерированные пароли Docker.

Проверка после запуска:

```powershell
docker compose ps -a
docker compose run --rm db_migrate python -m database.inspect_db
```

Инициализация учётной записи в контейнере выполняется только при пустом томе.
Изменение пароля в `.env` не меняет пароль уже созданной учётной записи PostgreSQL.
Обычный `docker compose down` сохраняет том. Флаг `-v` удаляет данные и не нужен для обычного перезапуска.

## Подключение backend

Модели: `database.models`. Запрос прав: `database.queries.permission_codes_for_user`.
При регистрации backend создаёт пользователя и назначает ему роль `user` в одной транзакции.
Хэширование Argon2id, валидация пароля, статусы HTTP и проверки прав выполняются backend.

В `docker-compose.yml` сервис `backend` получает адрес контейнерной БД и запускается
после успешного завершения `db_migrate`:

```yaml
environment:
  DATABASE_URL: ${DOCKER_DATABASE_URL:?Run python -m database.configure_docker}
depends_on:
  db_migrate:
    condition: service_completed_successfully
```

У контейнера backend адрес БД - `db:5432`. У локальных инструментов для контейнерной БД -
`127.0.0.1:5433`. Внутри backend-контейнера нельзя использовать localhost для подключения к сервису db.

Существующие права:

| Роль | Права |
| --- | --- |
| user | `profile.read` |
| moderator | `profile.read`, `users.read` |
| admin | `profile.read`, `users.read`, `users.manage`, `roles.manage` |

### HTTP API

После запуска Compose документация доступна по адресу <http://127.0.0.1:8000/docs> при порте по умолчанию.

| Метод и путь | Назначение |
| --- | --- |
| `GET /api/health` | Проверка работы HTTP API. |
| `GET /api/health/db` | Проверка подключения к PostgreSQL. |
| `POST /api/register` | Регистрация по `login` и `password`. Ответ `201` при успехе, `409` при занятом логине, `422` при ошибке валидации. |
| `POST /api/login` | Проверка логина и пароля. Возвращает `access_token` и `token_type` либо `401` при неверных данных. |
| `GET /api/me` | Собственный профиль, роли и права. Требует `profile.read`. |
| `GET /api/users` | Список ID и логинов пользователей. Требует `users.read`. |
| `PUT /api/users/{target_user_id}/roles/{role_name}` | Назначение роли. Требует `roles.manage`, при успехе возвращает `204`. |

Защищённые маршруты принимают заголовок `Authorization: Bearer <access_token>`.
При отсутствии действующего токена API возвращает `401`, при недостатке прав — `403`.

```bash
curl -i http://127.0.0.1:8000/api/register \
  -H 'Content-Type: application/json' \
  -d '{"login":"readme.demo","password":"ReadmeDemo42!"}'

curl -i http://127.0.0.1:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"readme.demo","password":"ReadmeDemo42!"}'
```

Сохраните токен из ответа на вход в переменной `USER_TOKEN` и запросите профиль:

```bash
curl -i http://127.0.0.1:8000/api/me \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Автотесты API

Тесты используют отдельную базу `pasis_api_test`. При работающем сервисе `db` создайте её один раз:

```bash
docker compose exec db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" createdb -h 127.0.0.1 -U postgres --owner="$APP_DB_USER" pasis_api_test'
```

Из корня проекта в активном виртуальном окружении установите зависимости и примените миграции
к тестовой базе:

```bash
python -m pip install -r requirements-backend.txt pytest httpx

python - <<'PY'
import os
import subprocess
import sys

from sqlalchemy.engine import make_url

from database.config import get_database_url

test_url = make_url(get_database_url()).set(database="pasis_api_test")
env = os.environ.copy()
env["DATABASE_URL"] = test_url.render_as_string(hide_password=False)
subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], env=env, check=True)
PY

python -m pytest -q tests/backend
```

Результат — **5 passed**. Проверены успешная регистрация, дубликат логина, слабый пароль,
отказ обычному пользователю и разрешение доступа после назначения роли `moderator`.

## Безопасность

Уникальный индекс логина, CHECK и NOT NULL, внешние ключи и составные первичные ключи,
параметризованные запросы, исключение `.env` и `.venv` из Git, скрытие параметров в логах SQLAlchemy.
Полные сведения находятся в разделе безопасности [инструкции БД](database/README.md#безопасность-что-сделано).

- Бэкенд сохраняет хэш Argon2id со случайной солью. Параметры хэширования задаются через `ARGON2_TIME_COST`, `ARGON2_MEMORY_COST` и `ARGON2_PARALLELISM`.
- При входе бэкенд сверяет пароль с хэшем и выдаёт подписанный JWT на 30 минут. На защищённых маршрутах сервер проверяет токен и читает актуальные права из БД.
- Успешная регистрация, занятый логин и ошибки валидации логируются на уровне `INFO`, ошибки записи и БД — на уровне `ERROR`. Сообщения содержат JSON-поле `event`. Пароли, хэши и токены в эти сообщения не включаются. Ответ `422` содержит только имя поля и причину ошибки.
