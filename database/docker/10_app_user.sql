-- Runs once on the first initialization of an empty PostgreSQL Docker volume.
\set ON_ERROR_STOP on
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD
\getenv app_database POSTGRES_DB

BEGIN;
SET password_encryption = 'scram-sha-256';
CREATE ROLE :"app_user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD :'app_password';
ALTER DATABASE :"app_database" OWNER TO :"app_user";
REVOKE CONNECT ON DATABASE :"app_database" FROM PUBLIC;
COMMIT;
