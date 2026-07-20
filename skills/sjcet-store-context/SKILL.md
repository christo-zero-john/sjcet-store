---
name: sjcet-store-context
description: Load and enforce the authoritative SJCET Store requirements, shared architecture, team ownership, and active plans. Use for every planning, implementation, review, debugging, database, authentication, payment, UI, or documentation task in the sjcet-store repository.
---

# SJCET Store Context

1. Read `AGENTS.md`.
2. Read `docs/architecture/project-foundation.md`.
3. Read `docs/team/development-guide.md`.
4. Read the relevant documents under `docs/requirements/`.
5. Read applicable decisions and active plans.
6. For database work, read `docs/supabase/main_schema.sql`.
7. Keep the canonical schema synchronized with every migration. Preserve it as
   a clean empty-database setup without incremental migration patches or seeds.
8. State which shared contracts the task touches.
9. Preserve module boundaries and update documentation with contract changes.
10. Run fresh, task-appropriate verification before reporting completion.

Treat the repository documents as more authoritative than this skill if they
change later.
