# Verify role-aware workspaces

Use these scenarios for server-action, routing, and browser acceptance tests.

## RA-001: Super-admin destination

Given a confirmed user with `super_admin`, login and confirmation redirect to
`/super-admin`. Opening `/store-manager` remains allowed but is not automatic.

## RA-002: Store-manager destination

Given a confirmed user with `store_manager` and no `super_admin`, login and
confirmation redirect to `/store-manager/products`. Opening `/super-admin`
redirects to the manager workspace.

## RA-003: Student/customer destination

Given an authenticated user without either administrative role, login and
confirmation redirect to `/dashboard`. Manager URLs redirect to `/dashboard`
without showing another login form or a store-manager-access error.

## RA-004: Existing-user assignment

Given a super admin enters the college email of an existing Auth user, the
system assigns `store_manager`, lists the user as active, and records an audit
event.

## RA-005: New-user invitation

Given the email does not yet belong to an Auth user, the system sends an Auth
invitation, lists it as pending, and assigns `store_manager` after the confirmed
invitee is synchronized.

## RA-006: Invitation maintenance

A super admin can explicitly resend or cancel a pending invitation. Provider
failures are visible as failed records rather than falsely reported as pending.

## RA-007: Removal and denial

A super admin can remove `store_manager` without deleting the account. Students
and store managers cannot list, invite, assign, cancel, resend, or remove
manager access through either application actions or database functions.

## Review checklist

- [ ] Role precedence is `super_admin`, then `store_manager`, then `/dashboard`
- [ ] All protected routes use the shared authorization helpers
- [ ] The service key is imported only by server-only code
- [ ] Role mutations are database-authorized and audited
- [ ] Pending, failed, cancelled, accepted, and active states are distinguishable
- [ ] Student/customer UI is intentionally minimal
