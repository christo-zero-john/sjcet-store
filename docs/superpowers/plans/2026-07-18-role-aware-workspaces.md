# Role-Aware Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every authenticated user to the correct workspace and let super admins dynamically invite, assign, find, and remove store managers.

**Architecture:** A pure role-destination helper defines routing precedence. Server-only authorization resolves trusted roles and guards each workspace. Supabase Postgres owns manager invitation state, role mutations, and audit events; Next.js Server Actions compose those functions with Supabase Auth administration without exposing the secret key.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase Auth/Postgres, Zod 4.3.6, Vitest 4.1.10, Playwright 1.61.1, and pnpm.

## Global Constraints

- Read the repository foundation, relevant requirements, approved role-workspace spec, canonical schema, and this plan before each task.
- Keep application code under `client-side/` and Supabase files under `docs/supabase/`.
- Keep `docs/supabase/main_schema.sql` as the clean empty-database setup.
- Append schema changes to the single `docs/supabase/migrations/20260718090000_product_first_inventory.sql` migration.
- Never expose `SUPABASE_SECRET_KEY` to the browser.
- Only `super_admin` may mutate store-manager access.
- Keep initial super-admin bootstrapping controlled by `INITIAL_SUPER_ADMIN_EMAILS`.
- Do not apply remote Supabase changes or use Docker.
- Preserve all unrelated and uncommitted work.
- Use test-first red, green, review, fix, and fresh verification for every task.

---

## File Map

| Path | Responsibility |
|---|---|
| `client-side/features/auth/role-destination.ts` | Pure role precedence |
| `client-side/features/auth/authorization.ts` | Authenticated, student, store, and super-admin guards |
| `client-side/features/super-admin/contracts.ts` | Manager-access records and action results |
| `client-side/features/super-admin/actions.ts` | Super-admin Server Actions and Auth invitation composition |
| `client-side/features/super-admin/manager-access-panel.tsx` | Active/pending manager UI |
| `client-side/app/super-admin/layout.tsx` | Super-admin capability boundary |
| `client-side/app/super-admin/page.tsx` | Super-admin dashboard |
| `client-side/app/dashboard/page.tsx` | Minimal student/customer landing |
| `docs/supabase/migrations/20260718090000_product_first_inventory.sql` | Invitation state and manager role functions |
| `docs/supabase/main_schema.sql` | Canonical final schema |
| `docs/supabase/tests/store_manager_provisioning.test.sql` | Authorization, state, idempotency, and audit tests |

### Task 1: Define authoritative role destinations

**Files:**

- Create: `client-side/features/auth/role-destination.ts`
- Create: `client-side/features/auth/role-destination.test.ts`
- Modify: `client-side/features/auth/authorization.ts`
- Modify: `client-side/features/auth/authorization.test.ts`

**Interfaces:**

- Produces: `destinationForRoles(roles: readonly AppRole[]): "/super-admin" | "/store-manager/products" | "/dashboard"`.
- Produces: `requireAuthenticatedUser()`, `requireStudentLanding()`, and `requireSuperAdmin()`.
- Keeps: `requireStoreOperator()` and `canManageStore()`.

- [ ] **Step 1: Write failing destination tests**

```ts
expect(destinationForRoles(["student"])).toBe("/dashboard");
expect(destinationForRoles(["store_manager"])).toBe("/store-manager/products");
expect(destinationForRoles(["store_manager", "super_admin"])).toBe("/super-admin");
```

Add capability assertions proving only `super_admin` passes `canManageUsers`.

- [ ] **Step 2: Verify red**

Run `pnpm vitest run features/auth/role-destination.test.ts features/auth/authorization.test.ts`.

Expected: failure because `destinationForRoles` and `canManageUsers` do not exist.

- [ ] **Step 3: Implement the pure helper and guards**

Use exact precedence:

```ts
if (roles.includes("super_admin")) return "/super-admin";
if (roles.includes("store_manager")) return "/store-manager/products";
return "/dashboard";
```

`requireStoreOperator()` redirects an authenticated unauthorized user to `/dashboard?notice=...`. `requireSuperAdmin()` redirects a store manager to `/store-manager/products` and other authenticated users to `/dashboard`. None of these access-denied paths redirect valid users to `/auth`.

- [ ] **Step 4: Verify green and review**

Run the focused tests. Review role precedence, multi-role users, and redirect loops. Fix findings and rerun.

### Task 2: Add manager invitation and role database contracts

**Files:**

- Modify: `docs/supabase/migrations/20260718090000_product_first_inventory.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `client-side/scripts/validate-main-schema.mjs`
- Create: `docs/supabase/tests/store_manager_provisioning.test.sql`

**Interfaces:**

- Produces: `private.store_manager_invitations`.
- Produces: `public.request_store_manager_access(target_email text, target_display_name text) returns jsonb`.
- Produces: `public.list_store_manager_access() returns jsonb`.
- Produces: `public.remove_store_manager_access(target_user_id uuid) returns void`.
- Produces: `public.cancel_store_manager_invitation(target_email text) returns void`.
- Produces: `public.mark_store_manager_invitation_resent(target_email text) returns void`.
- Produces: `public.mark_store_manager_invitation_failed(target_email text, failure_code text) returns void`.
- Extends: `public.authorize_user_roles(uuid, boolean)` to accept confirmed pending manager invitations.

- [ ] **Step 1: Write failing SQL tests**

Cover:

```sql
select throws_ok(
  $$select public.request_store_manager_access('student@cs.sjcetpalai.ac.in', null)$$,
  '42501',
  'Super-admin access is required.',
  'students cannot create store managers'
);
```

Add cases for immediate assignment of a confirmed account, pending invitation for an unknown email, duplicate request idempotency, cancellation, removal, role claim after confirmation, and an audit row for each transition.

- [ ] **Step 2: Verify structural red without Docker**

Add required-fragment assertions to `validate-main-schema.mjs`, then run `pnpm schema:check`.

Expected: failure because the invitation table and functions are absent. Do not invoke local Supabase or Docker.

- [ ] **Step 3: Implement the final schema and migration**

Use normalized lowercase email with a unique constraint and a checked state of `pending`, `accepted`, `cancelled`, or `failed`. Every public mutation is `security definer`, uses `set search_path = ''`, checks `private.has_role('super_admin')`, and writes `audit_events`.

`authorize_user_roles` remains service-role-only. When the target user is confirmed and has a pending invitation matching `lower(auth.users.email)`, it inserts `store_manager`, marks the invitation accepted, attaches the user ID, and audits the assignment before returning roles.

- [ ] **Step 4: Verify green and review**

Run `pnpm schema:check` and `git diff --check`. Review direct-table access, arbitrary role assignment, email normalization, duplicate invitations, and unconfirmed-user escalation. Fix findings and rerun.

### Task 3: Compose Supabase Auth invitations in Server Actions

**Files:**

- Create: `client-side/features/super-admin/contracts.ts`
- Create: `client-side/features/super-admin/invitation.ts`
- Create: `client-side/features/super-admin/invitation.test.ts`
- Create: `client-side/features/super-admin/actions.ts`
- Modify: `client-side/lib/supabase/admin.ts`

**Interfaces:**

- Produces: `normalizeManagerEmail(email: string): string`.
- Produces: `managerInviteRedirect(siteUrl: string): string`.
- Produces Server Actions: `addStoreManager`, `resendStoreManagerInvitation`, `cancelStoreManagerInvitation`, and `removeStoreManager`.

- [ ] **Step 1: Write failing validation tests**

Prove normalization, rejection of the bare `sjcetpalai.ac.in` domain, acceptance of multiple college subdomains, and a confirmation redirect of `${siteUrl}/auth/confirm`.

- [ ] **Step 2: Verify red**

Run `pnpm vitest run features/super-admin/invitation.test.ts`.

Expected: module-not-found failure.

- [ ] **Step 3: Implement the helper and actions**

Every action first calls `requireSuperAdmin()`. `addStoreManager` calls `request_store_manager_access`; when the result says an Auth invitation is required, call `admin.auth.admin.inviteUserByEmail`. Resend uses Supabase Auth resend plus the database audit function. Cancel changes invitation state; removal removes only `store_manager`.

Use redirects back to `/super-admin` with encoded message or error. Log provider error codes without logging secret keys or invitation links.

- [ ] **Step 4: Verify green and review**

Run the focused tests and typecheck. Review secret-key boundaries, provider failure behavior, and server-action authorization. Fix findings and rerun.

### Task 4: Route authentication entry points

**Files:**

- Modify: `client-side/features/auth/actions.ts`
- Modify: `client-side/app/auth/confirm/route.ts`
- Modify: `client-side/app/page.tsx`
- Modify: `client-side/app/page.test.tsx`
- Create: `client-side/features/auth/role-routing.test.ts`

**Interfaces:**

- Consumes: `destinationForRoles` and `getServerAuthorizedRoles`.
- Produces: consistent post-login, post-confirmation, and root-route behavior.

- [ ] **Step 1: Write failing source-contract tests**

Assert that all three entry points consume the shared destination helper and that no successful path hardcodes `/store-manager`.

- [ ] **Step 2: Verify red**

Run the focused tests and confirm failure on current hardcoded redirects.

- [ ] **Step 3: Implement role-aware redirects**

After sign-in, fetch the authenticated user, authorize roles, and redirect to `destinationForRoles`. After OTP verification, perform the same resolution and return a `NextResponse` to the destination. The root route resolves authenticated roles and sends anonymous users to `/auth`.

- [ ] **Step 4: Verify green and review**

Run focused tests and typecheck. Review missing-user, authorization-function failure, and redirect-loop paths.

### Task 5: Build super-admin and minimal student workspaces

**Files:**

- Create: `client-side/features/super-admin/manager-access-panel.tsx`
- Create: `client-side/features/super-admin/manager-access-panel.test.tsx`
- Create: `client-side/app/super-admin/layout.tsx`
- Create: `client-side/app/super-admin/page.tsx`
- Create: `client-side/app/dashboard/page.tsx`
- Create: `client-side/app/dashboard/page.test.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: authorization guards and super-admin actions.
- Produces: dedicated `/super-admin` and minimal `/dashboard`.

- [ ] **Step 1: Write failing UI tests**

The super-admin markup must include Add Store Manager, search, active/pending status, open-store-manager link, and sign-out. The student markup must contain Student / Customer identity and sign-out but must not contain fake orders, store controls, or printing controls.

- [ ] **Step 2: Verify red**

Run both focused component tests and confirm module-not-found failures.

- [ ] **Step 3: Implement accessible server-first pages**

Use Server Components for reads and one focused client panel only where search disclosure needs client state. Use semantic forms, labels, status text, focus-visible controls, and responsive layouts. Keep the student page intentionally minimal.

- [ ] **Step 4: Verify green and review**

Run focused tests, typecheck, lint, and a browser review at desktop and mobile widths. Fix authorization, accessibility, and layout findings.

### Task 6: Synchronize docs and run the role-workspace gate

**Files:**

- Modify: `docs/architecture/project-foundation.md`
- Modify: `docs/requirements/superadmin.md`
- Modify: `docs/requirements/store_students.md`
- Modify: `docs/team/development-guide.md`
- Create: `client-side/tests/e2e/role-aware-workspaces.spec.ts`

- [ ] **Step 1: Add acceptance coverage**

Cover super-admin, store-manager, and student destinations plus unauthorized direct URLs. Gate credential-dependent tests with explicit environment checks and report skips.

- [ ] **Step 2: Update shared documentation**

Document route precedence, dynamic manager provisioning, server-only invitation composition, minimal student scope, and ownership boundaries.

- [ ] **Step 3: Run the complete gate**

Run:

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
git diff --check
```

Record browser-test skips as an environmental limitation rather than a pass for those scenarios.
