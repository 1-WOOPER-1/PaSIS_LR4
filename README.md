# ПАСЗИ: лабораторная работа 4, вариант 3

Регистрация пользователя и ролевая модель разграничения доступа (RBAC).

В этой ветке реализован компонент **database**: PostgreSQL, пять таблиц, модели SQLAlchemy,
миграции Alembic, роли и права, запрос получения прав пользователя, 23 проверки БД
и конфигурация Docker для PostgreSQL и запуска миграций.

Frontend, HTTP API регистрации, аутентификация и проверки доступа в API добавляются другими
участниками. Проверки схемы БД не заменяют тесты регистрации и проверки фактического доступа через API.

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

Требуются Docker с Compose и Python 3.11 или новее для первоначальной подготовки `.env`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-db.txt
.\.venv\Scripts\python.exe -m database.configure_docker
docker compose up --build
```

После однократной настройки `.env` запуск выполняется одной командой `docker compose up`.
После изменения исходников или зависимостей используйте `docker compose up --build`.

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

Конфигурация Docker подготовлена и проверена отдельно по синтаксису и логике инициализации.
Полный запуск контейнеров и интеграция всего приложения должны быть подтверждены в среде с Docker.

## Подключение backend

Модели: `database.models`. Запрос прав: `database.queries.permission_codes_for_user`.
При регистрации backend создаёт пользователя и назначает ему роль `user` в одной транзакции.
Хэширование Argon2id/bcrypt, валидация пароля, статусы HTTP и проверки прав выполняются backend.

Для будущего сервиса backend в `docker-compose.yml` используйте:

```yaml
environment:
  DATABASE_URL: ${DOCKER_DATABASE_URL:?Prepare local .env first}
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

Подробные договорённости по транзакциям, уникальности логина и безопасным ответам API:
[database/README.md](database/README.md#договорённости-для-backend).

## Проверки и материалы отчёта

- [Протокол проверок](database/VALIDATION.md).
- [Скриншоты участника](database/report/).
- [Тесты БД](tests/database/test_database.py).
- [Миграции](migrations/versions/).
- [Описание структуры и ограничений](database/README.md#таблицы-и-ограничения).

На компьютере участника: Windows 11, Python 3.15.0, PostgreSQL 18.6; **23 passed**.
В тестовой среде дополнительно проверены повторный запуск миграций, откат и повторное создание схемы.

## Безопасность: что сделано

Уникальный индекс логина, CHECK и NOT NULL, внешние ключи и составные первичные ключи,
параметризованные запросы, исключение `.env` и `.venv` из Git, скрытие параметров в логах SQLAlchemy.
Схема предусматривает `password_hash`; корректное хэширование и защиту API реализует backend.
Полные сведения находятся в разделе безопасности [инструкции БД](database/README.md#безопасность-что-сделано).

Для общей сдачи команда добавляет frontend и backend с отдельными Dockerfile, HTTP-тесты,
описание API/curl и скриншоты регистрации и разрешённого/запрещённого доступа.
