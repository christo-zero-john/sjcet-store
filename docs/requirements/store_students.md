# Store Student Requirements

## Current scope

The student/customer store module is intentionally a placeholder because it is
owned by another team member. This implementation establishes only the shared
authenticated destination and must not invent shopping behavior.

## Routing and page

- Any authenticated user who is neither `super_admin` nor `store_manager`
  lands on `/dashboard`.
- The page identifies the account as a student/customer and confirms that the
  account is ready.
- The page provides logout and no manager controls.
- Students opening `/store-manager` or `/super-admin` are redirected safely to
  `/dashboard`.

Future student-store work must reuse shared Auth, catalog read contracts,
orders, payments, money helpers, and Supabase clients rather than duplicating
them.

## Acceptance

1. A normal confirmed college account signs in and reaches `/dashboard`.
2. The page contains no inventory, role-management, payment-administration, or
   category-management controls.
3. Opening a protected manager URL does not show a misleading store-manager
   login error for an already authenticated student.
