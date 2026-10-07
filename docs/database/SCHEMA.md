# Database schema

PostgreSQL 16. Defined in [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts); applied by the SQL migration [`apps/api/drizzle/0000_init.sql`](../../apps/api/drizzle/0000_init.sql).

![ER diagram](ER-DIAGRAM.png)

## Relationships

| Relationship | Cardinality | Foreign key | On delete |
|---|---|---|---|
| users → projects | 1 : N | `projects.user_id → users.id` | CASCADE |
| projects → tasks | 1 : N | `tasks.project_id → projects.id` | CASCADE |
| users → refresh_tokens | 1 : N | `refresh_tokens.user_id → users.id` | CASCADE |
| users → audit_logs | 1 : N | `audit_logs.user_id → users.id` | CASCADE |

Deleting a project deletes its tasks in the database itself, so no orphan tasks can exist even if application code changes later.

## Tables

### users
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| full_name | varchar(100) | NOT NULL |
| email | varchar(254) | NOT NULL, **unique index on `lower(email)`** |
| password_hash | text | NOT NULL (bcrypt) |
| created_at, updated_at | timestamptz | NOT NULL, default now() |

### projects
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | NOT NULL, FK → users |
| name | varchar(120) | NOT NULL |
| description | text | NOT NULL, default '' |
| status | enum `project_status` | NOT_STARTED / IN_PROGRESS / COMPLETED, default NOT_STARTED |
| start_date | date | NOT NULL |
| end_date | date | nullable, **CHECK (end_date IS NULL OR end_date >= start_date)** |
| created_at, updated_at | timestamptz | |

### tasks
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| project_id | uuid | NOT NULL, FK → projects |
| name | varchar(160) | NOT NULL |
| description | text | NOT NULL, default '' |
| priority | enum `task_priority` | LOW / MEDIUM / HIGH, default MEDIUM |
| status | enum `task_status` | PENDING / IN_PROGRESS / COMPLETED, default PENDING |
| due_date | date | nullable |
| completed_at | timestamptz | set by the server when status becomes COMPLETED |
| created_at, updated_at | timestamptz | |

### refresh_tokens
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| token_hash | varchar(64) | unique; SHA-256 of the token — the raw token is never stored |
| family_id | uuid | one per login; used to revoke a whole session on token reuse |
| expires_at | timestamptz | |
| revoked_at, revoked_reason | timestamptz, varchar(20) | `rotated`, `logout`, `logout_all`, `reuse_detected` |

### audit_logs
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| action | enum `audit_action` | USER_REGISTERED, LOGIN, LOGOUT, LOGOUT_ALL, PROJECT_CREATED/UPDATED/DELETED, TASK_CREATED/UPDATED/DELETED |
| entity_type | varchar(20) | USER / PROJECT / TASK |
| entity_id | uuid | **no FK on purpose**: the log entry must survive deletion of what it describes |
| entity_name | varchar(160) | name at the time of the action; no request bodies, passwords or tokens |

## Design decisions

**Normalisation (3NF).** Every fact is stored once. Tasks do not have a `user_id`: the owner is derived through `projects.user_id`. Denormalising it would make task queries one join cheaper but would create two sources of truth that could disagree, for example after a task moves between projects. Ownership checks for tasks therefore join (or sub-select) through `projects`.

**UUID keys.** IDs appear in URLs, and sequential integers would leak counts and invite ID-guessing. Authorization never relies on IDs being unguessable, though: every query also filters by owner.

**`date` for calendar dates, `timestamptz` for moments.** A due date of 2026-10-07 must not become 2026-10-06 for a user in a different timezone, so calendar dates are stored as `date` and travel as `YYYY-MM-DD` strings. Created/updated times are instants and use `timestamptz`.

**Enums in the database.** Statuses and priorities are Postgres enums, so an invalid value is rejected even by a manual SQL insert. `task_priority` is declared LOW → MEDIUM → HIGH, so `ORDER BY priority` sorts by importance, not alphabetically.

**Constraints as a second line of defence.** Zod validates first and returns friendly messages. The database still enforces uniqueness (`lower(email)`), date order (CHECK), enums and foreign keys, so a bug in application code cannot store invalid data.

## Indexes

| Index | Serves |
|---|---|
| `users_email_lower_unique (lower(email))` | Login lookup and case-insensitive uniqueness |
| `projects (user_id, created_at)` | "My projects, newest first" — the default list |
| `projects (user_id, status)` | Status filter and dashboard counts |
| `tasks (project_id, created_at)` | Tasks of a project; also serves the ownership join |
| `tasks (project_id, status)` | Status filter, project progress counts, dashboard |
| `tasks (project_id, priority)` | Priority filter |
| `tasks (due_date)` | Due-soon and overdue queries |
| `refresh_tokens (token_hash)` unique, `(user_id)`, `(family_id)` | Refresh lookup, sign-out-everywhere, family revocation |
| `audit_logs (user_id, created_at)` | Activity feed |

Composite indexes starting with the owner column also serve plain `WHERE user_id = ?` lookups (leftmost-prefix rule), so separate single-column indexes on `user_id` and `project_id` would be redundant.

Name search uses `ILIKE '%term%'`, which cannot use a B-tree index. That is fine at this scale; the upgrade path is a `pg_trgm` GIN index.

## Migrations and seed data

```bash
npm run db:migrate     # apply pending migrations (idempotent; runs automatically on deploy)
npm run db:seed        # recreate demo@example.com / Demo@12345 with 4 projects and 15 tasks
npm run db:generate -w @pms/api   # after editing schema.ts: generate the next SQL migration
```

Seed dates are relative to the day it runs, so the dashboard always shows a realistic mix of overdue, due-soon and completed work. Only the demo account is touched.
