# Claude Code Instructions

Follow `AGENTS.md` as the repository-wide authority.

For every task, read the current shared foundation, relevant module
requirements, team guide, decisions, and active plan before acting. Discover
and use matching project-local skills under `.claude/skills/`. Never bypass the
document-reading requirement because a task appears small or familiar.

For every database task, read and maintain
`docs/supabase/main_schema.sql`. It is the canonical clean setup script
and must remain synchronized with migrations.

Never rename or delete an existing migration. Follow the repository migration
filename rule in `AGENTS.md` for every new migration:
`YYYYMMDDHHMMSS_<slno>-<dd>-<MM>-<yyyy>-<name>.sql`.
