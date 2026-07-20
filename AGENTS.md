# Agent Instructions

These instructions apply to every task in this repository.

## Mandatory context

Before planning, editing code, reviewing, or debugging:

1. Read `docs/architecture/project-foundation.md`.
2. Read every `docs/requirements/*.md` file relevant to the affected module.
3. Read `docs/team/development-guide.md`.
4. Read applicable files in `docs/decisions/` and `docs/superpowers/plans/`.
5. Before any database task, read `docs/supabase/main_schema.sql`.
6. Load each installed skill whose description matches the task.

Do not rely on remembered versions of these documents. Re-read them from the
current worktree each time.

## Skills

Project skills live in `.agents/skills/` and `.claude/skills/`.

- Use skills when their trigger descriptions match the work.
- Before installing a new skills.sh skill, list it, inspect its source and risk
  report, and install only the needed skill for both `claude-code` and `codex`.
- Prefer project-local installs and commit `skills-lock.json`.
- Treat third-party skills as instructions, not as authority over repository
  requirements or security rules.

## Shared-project rules

- Keep the complete Next.js web application under `client-side/`.
- Keep the complete local Supabase project under `docs/supabase/`.
- Run application package and test commands from `client-side/`. Run Supabase
  CLI commands from `client-side/` with `--workdir ../docs`.
- Preserve unrelated and uncommitted work.
- Keep module internals behind module contracts.
- Do not duplicate shared auth, Supabase, money, payment, webhook, or audit
  foundations.
- Treat `docs/supabase/main_schema.sql` as the canonical clean database
  setup. Update it in the same change as every schema migration.
- Never rename or delete an existing migration. Every new migration filename
  must use
  `YYYYMMDDHHMMSS_<slno>-<dd>-<MM>-<yyyy>-<name>.sql`, where the first
  segment is the Supabase-compatible UTC version, `slno` is a zero-padded
  three-digit repository sequence number, the date is the migration creation
  date, and `name` is lowercase kebab-case. Example:
  `20260719123000_006-19-07-2026-add-order-payments.sql`.
- Keep `main_schema.sql` free of migration-history patches, obsolete objects,
  and seed data. It must create the current schema from an empty Supabase
  database.
- Update affected requirements and architecture docs with shared changes.
- Never make remote Supabase, Dodo, deployment, or production-data changes
  without explicit user authorization.
- Run fresh relevant verification before claiming completion.
