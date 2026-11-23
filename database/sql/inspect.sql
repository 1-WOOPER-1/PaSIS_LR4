-- Read-only queries for pgAdmin Query Tool or psql.
SELECT current_database() AS database_name, current_user AS db_user,
       current_setting('server_encoding') AS encoding;

SELECT version_num FROM alembic_version;

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT r.name AS role, p.code AS permission
FROM roles AS r
JOIN role_permissions AS rp ON rp.role_id = r.id
JOIN permissions AS p ON p.id = rp.permission_id
ORDER BY CASE r.name WHEN 'user' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, p.code;

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'users';
