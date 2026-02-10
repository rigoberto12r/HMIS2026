# Alembic Migration Fixes Summary

## Files Modified
1. `hmis-backend/migrations/versions/001_initial_schema.py`
2. `hmis-backend/migrations/versions/002_accounting_tables.py`

## Changes Applied

### Migration File: 001_initial_schema.py
- **JSONB '[]' defaults**: 1 occurrence fixed
  - Changed from: `server_default="[]"`
  - Changed to: `server_default=sa.text("'[]'::jsonb")`

- **Boolean 'true' defaults**: 34 occurrences fixed
  - Changed from: `server_default="true"`
  - Changed to: `server_default=sa.text("true")`

- **Boolean 'false' defaults**: 9 occurrences fixed
  - Changed from: `server_default="false"`
  - Changed to: `server_default=sa.text("false")`

- **Integer '0' defaults**: 6 occurrences fixed
  - Changed from: `server_default="0"`
  - Changed to: `server_default=sa.text("0")`

**Total fixes in file 1**: 50 occurrences

### Migration File: 002_accounting_tables.py
- **Boolean 'true' defaults**: 4 occurrences fixed
  - Changed from: `server_default="true"`
  - Changed to: `server_default=sa.text("true")`

**Total fixes in file 2**: 4 occurrences

## Total Changes
- **Combined total**: 54 server_default syntax fixes across both migration files

## Reason for Changes
The original syntax was incorrect for PostgreSQL server defaults:
- Plain strings like `"true"`, `"false"`, `"0"` need to be wrapped in `sa.text()` to be treated as SQL expressions
- JSONB defaults like `"[]"` need explicit casting with `::jsonb` to ensure PostgreSQL interprets them correctly
- These changes ensure Alembic generates proper DDL statements for PostgreSQL

## Examples of Fixed Code

### Before:
```python
sa.Column("permissions", postgresql.JSONB, server_default="[]"),
sa.Column("is_active", sa.Boolean, server_default="true"),
sa.Column("is_system_role", sa.Boolean, server_default="false"),
sa.Column("failed_login_attempts", sa.Integer, server_default="0"),
```

### After:
```python
sa.Column("permissions", postgresql.JSONB, server_default=sa.text("'[]'::jsonb")),
sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
sa.Column("is_system_role", sa.Boolean, server_default=sa.text("false")),
sa.Column("failed_login_attempts", sa.Integer, server_default=sa.text("0")),
```

## Verification
All changes have been verified to follow the correct SQLAlchemy/Alembic pattern for PostgreSQL server defaults.
