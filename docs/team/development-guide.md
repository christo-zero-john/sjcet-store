# Team Development Guide

## 1. Working agreement

This repository is designed for 5–8 contributors working on separate modules.
Every contributor owns outcomes, tests, and documentation for their changes.

Before planning or coding:

1. read `AGENTS.md`;
2. read `docs/architecture/project-foundation.md`;
3. read the relevant file under `docs/requirements/`;
4. read applicable decisions and the active plan under
   `docs/superpowers/plans/`;
5. read `docs/supabase/main_schema.sql` for database work;
6. load any installed skill whose description matches the task.

## 2. Ownership

Suggested ownership boundaries:

| Area | Primary owner | Shared review required |
|---|---|---|
| shared auth, roles, RLS | foundation | yes |
| payments and webhooks | foundation | yes |
| store-manager module | store manager | for shared contracts |
| student-store module | student store | for shared contracts |
| print-admin module | print admin | for shared contracts |
| print-student module | print student | for shared contracts |
| super-admin module | super admin | yes |

`CODEOWNERS` will encode actual GitHub usernames once the team supplies them.

## 3. Change boundaries

- All web-application files belong under `client-side/`.
- The complete local Supabase project belongs under `docs/supabase/`.
- Run Supabase CLI commands from `client-side/` with `--workdir ../docs`.
- A module owns its route group, feature directory, tests, and requirement file.
- Shared feature changes need a foundation review.
- Do not duplicate shared auth, money, payment, audit, or Supabase clients.
- Do not change another module's contract without updating its requirement and
  notifying its owner in the pull request.
- Database migrations are append-only after merge.
- Every schema migration must update
  `docs/supabase/main_schema.sql` in the same pull request.
- `main_schema.sql` is a clean snapshot for an empty database. Never copy
  incremental `ALTER`, rename, backfill, rollback, or cleanup history into it.

## 4. Branches and pull requests

- Branch names: `type/module-short-description`.
- Commit messages follow Conventional Commits.
- Keep pull requests focused on one independently testable outcome.
- Pull requests must state requirements covered, schema/security impact,
  screenshots for UI changes, and exact verification commands.
- At least one module owner reviews normal changes; shared foundation,
  migrations, auth, RLS, and payments need two reviewers.

## 5. Definition of done

- Requirement and acceptance scenario are identified.
- Unit/integration tests cover business rules.
- Relevant browser flow passes.
- Typecheck, lint, and test commands pass from a clean invocation.
- RLS and authorization are tested for both allow and deny cases.
- The canonical schema passes `pnpm schema:check` and recreates an empty local
  Supabase database whenever the change affects the database.
- Documentation and architecture decisions are synchronized.
- No secret, service-role key, or production credential is committed.

## 6. Skills

Project-local skills are installed for Claude Code and Codex. Agents must:

- select skills from their descriptions, not load every skill blindly;
- read the full selected `SKILL.md` before acting;
- inspect newly downloaded third-party skills before use;
- install an additional project-local skill from skills.sh when a task needs
  specialized guidance not already present; and
- commit `skills-lock.json` so skill sources and hashes remain reviewable.

External skills currently cover planning, TDD, debugging, completion
verification, React/Next.js, web UI review, and Supabase/Postgres.
