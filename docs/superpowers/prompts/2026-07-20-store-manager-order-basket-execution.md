# Execute the store-manager order basket plan

Copy the prompt below into a fresh agent session opened at
`F:\GitHub\sjcet-store`.

## Prompt

You are the implementation agent for the SJCET Store store-manager order
basket module. Work from the repository root at `F:\GitHub\sjcet-store`.

Your objective is to implement the complete approved plan in:

`docs/superpowers/plans/2026-07-19-store-manager-order-basket.md`

Continue until every dependency-valid task is implemented and every available
verification gate has fresh evidence. Do not stop after scaffolding, a partial
UI, schema-only work, or unit tests.

### Read before acting

Read these files from the current worktree. Do not rely on remembered copies:

1. `AGENTS.md`
2. `docs/architecture/project-foundation.md`
3. `docs/requirements/store_manager.md`
4. `docs/team/development-guide.md`
5. `docs/testing/store-manager-order-basket-ui-acceptance.md`
6. `docs/superpowers/specs/2026-07-19-store-manager-order-basket-design.md`
7. `docs/superpowers/plans/2026-07-19-store-manager-order-basket.md`
8. `docs/runbooks/payments.md`
9. `docs/supabase/main_schema.sql`
10. Every applicable repository decision and active plan

Load and follow every installed skill whose description matches the current
task. At minimum:

- use `sjcet-store-context` for repository authority and ownership;
- use `executing-plans` to execute the plan inline;
- use `test-driven-development` before production implementation;
- use `systematic-debugging` for every test failure or unexpected result;
- use the Supabase and Postgres skills for schema, function, RLS, and database
  work;
- use `vercel-react-best-practices` for React and Next.js work; and
- use `verification-before-completion` before any completion claim.

Do not delegate or spawn subagents unless you receive separate authorization
for delegation.

### Preserve scope and existing work

Start with:

```powershell
git status --short
git log -5 --oneline
```

Preserve all unrelated and uncommitted work. Do not reset, revert, delete,
overwrite, or reformat unrelated files.

The following paths are strictly excluded:

```text
client-side/features/student/**
client-side/app/dashboard/**
docs/requirements/store_students.md
```

Do not implement guest authentication, student-store UI, or student order
history. The `/pay/` handoff belongs to shared orders/payments and may consume
only the existing shared-auth contract plus the narrowly approved safe return
path.

Do not modify print-admin, print-student, or super-admin behavior.

### Execute the plan

Execute the plan in dependency order unless a task is already satisfied by
verified current-worktree evidence.

For every task:

1. Mark the task or current step in progress in the plan before editing.
2. Inspect the exact current files named by the task.
3. Write one focused failing test.
4. Run it and confirm it fails for the expected missing behavior.
5. Implement the smallest production change that satisfies that test.
6. Run the focused test and confirm it passes.
7. Refactor only while tests stay green.
8. Run every verification command listed for that task.
9. Review the diff for authorization, data integrity, error handling,
   accessibility, performance, and scope.
10. Fix review findings and rerun affected verification.
11. Mark each checkbox complete immediately after its evidence passes.
12. Commit only the files owned by that task with the plan's commit message.

Do not batch checkbox updates at the end. Do not mark a step complete from code
inspection alone when the plan requires executable evidence.

Do not weaken, delete, skip, or rewrite a failing acceptance test to make the
implementation pass. Change a test only when it contradicts an accepted
requirement, and document the exact conflict before changing it.

Do not leave placeholders, temporary implementations, disabled assertions,
mock-only production paths, commented-out code, `TODO` markers, or
`@ts-ignore` escapes.

### Database rules

Keep the complete local Supabase project under `docs/supabase/`.

Run Supabase commands from `client-side/` with `--workdir ../docs`. For
example:

```powershell
npx supabase --workdir ../docs migration list
```

Create the new migration through the Supabase CLI workflow, then use the exact
required repository filename:

```text
docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql
```

Do not rename, delete, or edit the identity of an existing migration.

Update `docs/supabase/main_schema.sql` in the same change as every migration
edit. Keep it as a clean empty-database declaration. Never copy migration
history, patches, backfills, obsolete objects, or seed data into it.

Every public-schema table must enable and force Row Level Security where the
repository contract requires it. Revoke default access before granting narrow
capabilities. Test both allowed and denied roles.

Do not let application code write `product_variants.current_stock` directly.
Reservations must change available stock only. Cash completion and verified
online success must use the inventory transaction contract and append exactly
one sale movement per line.

### Payment rules

Keep the provider boundary genuinely replaceable:

- only `client-side/features/payments/providers/dodo.ts` may import the Dodo
  production SDK;
- basket, orders, inventory, QR, handoff, history, and bills must depend only
  on provider-neutral contracts;
- use the payment-attempt ID as the provider idempotency key;
- encode only the application-owned handoff URL in the QR;
- store only the SHA-256 handoff-token hash;
- never accept price, total, provider URL, actor, role, or stock authority from
  the browser;
- never treat a provider return URL as payment proof;
- verify the raw webhook before parsing or mutating data;
- require exact provider, checkout, order metadata, amount, and currency
  matches;
- process exact webhook replays idempotently;
- treat same-event-ID payload collisions as reconciliation failures;
- deduct stock only inside the verified-success database transaction; and
- keep raw payloads, secrets, full checkout URLs, and handoff tokens out of
  logs.

Map definitive provider rejection separately from ambiguous network,
connection, timeout, conflict, rate-limit, and server failures. Retain bounded
reservation state after ambiguous outcomes and retry with the same provider
idempotency key.

Do not call live Dodo. Use the fake-provider and deterministic webhook fixtures
required by the plan. Missing Dodo credentials block only credential-dependent
test-mode verification, not local provider-contract implementation.

### Local-only authority

You may edit local repository files, install the exact pinned dependencies
listed in the plan, run local tests, run local Supabase, and create local Git
commits.

You are not authorized to:

- change a remote Supabase project;
- change the Dodo dashboard;
- create or rotate live credentials;
- deploy;
- push branches;
- open a pull request;
- modify production data; or
- perform a live payment.

If a remote or production step becomes necessary, stop before that step,
record the exact requested action and reason, and request explicit
authorization. Do not treat approval of this implementation prompt as remote
write approval.

### Handle blockers without abandoning the plan

When a command fails, use systematic debugging. Read the full error, identify
the failing layer, reproduce it with the smallest relevant command, and fix
the cause.

If Docker or local Supabase is unavailable, complete independent application,
contract, component, and documentation work. Record the exact blocked database
commands and do not report them as passing.

If a required package, CLI, environment variable, or fixture is missing,
inspect repository configuration and the approved runbook before asking the
user. Make reasonable choices only inside the accepted design.

Do not replace the approved reservation, handoff, idempotency, RLS, or provider
architecture with a shortcut.

### Keep documentation synchronized

Update the approved documents whenever implementation reveals an actual
contract change:

- `docs/requirements/store_manager.md`
- `docs/architecture/project-foundation.md`
- `docs/testing/store-manager-order-basket-ui-acceptance.md`
- `docs/superpowers/specs/2026-07-19-store-manager-order-basket-design.md`
- `docs/runbooks/payments.md`
- `docs/supabase/main_schema.sql`

Do not change accepted behavior silently. Explain any required deviation,
update all affected authorities together, and preserve traceability from every
`SM-ORDER-*` scenario to its automated evidence.

### Completion gate

Before claiming completion, run fresh commands from `client-side/`:

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
pnpm test:e2e
git diff --check
```

From the repository root, run:

```powershell
git diff --name-only -- client-side/features/student client-side/app/dashboard docs/requirements/store_students.md
git status --short
git log --oneline --decorate -20
```

The forbidden-path diff must be empty.

Perform the manual desktop, mobile, keyboard, focus, print-preview, QR, cash,
online, history, and bill checks required by Task 12. Do not substitute passing
unit tests for browser or database evidence.

### Final response

Report:

1. the implemented behavior;
2. the task and acceptance-scenario coverage;
3. schema and security changes;
4. payment-provider boundary evidence;
5. exact verification commands and results;
6. commit hashes created during execution;
7. confirmation that excluded student paths are untouched; and
8. any genuinely unverified environment-dependent gates.

Do not say the module is complete while a required gate is failing, skipped
unexpectedly, or unexecuted. If all required gates pass, state that plainly
with the fresh evidence.
