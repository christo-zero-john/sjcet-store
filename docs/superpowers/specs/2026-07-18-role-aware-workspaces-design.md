---
meta:
  contentType: Reference
  title: Route users to role-specific workspaces
  navLabel: Role-Aware Workspaces Design
  category: Architecture
---

# Route users to role-specific workspaces

This design defines post-authentication routing, a dedicated super-admin workspace, dynamic store-manager provisioning, and a deliberately minimal student landing page.

## Document plan

- **Goal**: send every authenticated user to the correct workspace and let super admins manage store-manager access
- **Audience**: shared-foundation developers, module developers, database reviewers, and test authors
- **Content**: route precedence, authorization, super-admin navigation, manager invitations, student landing, auditing, and verification
- **Open questions**: none

## Scope

This delivery covers:

- one authoritative role-aware landing resolver
- a dedicated super-admin dashboard
- dynamic store-manager invitations and role assignment
- active and pending store-manager management
- a minimal authenticated student or customer landing page
- friendly cross-role redirects
- database-enforced authorization and audit history

It does not implement student-store shopping, student printing, print administration, order history, or other modules owned by separate team members.

## Role-aware landing

Authentication success, email confirmation, and authenticated visits to `/` use the same role resolver. Route precedence is:

| Effective role | Default destination |
|---|---|
| `super_admin` | `/super-admin` |
| `store_manager` | `/store-manager/products` |
| every other authenticated role | `/dashboard` |
| no authenticated user | `/auth` |

`super_admin` takes precedence when a user also holds `store_manager`. A super admin can enter the store-manager workspace from the super-admin dashboard, but the store-manager workspace is never the super admin's default landing.

The resolver reads authoritative server-side roles. Client metadata, query parameters, and form values never choose a privileged destination.

## Cross-role route behavior

Protected layouts enforce their own capability:

- unauthenticated requests redirect to `/auth`
- a student or other non-store role opening `/store-manager` redirects to `/dashboard` with a friendly notice
- a store manager opening `/super-admin` redirects to `/store-manager/products`
- a super admin can open both `/super-admin` and `/store-manager`

Authorization failures do not sign out valid users and do not present the login form as an access-denied screen.

## Super-admin dashboard

`/super-admin` is a dedicated workspace. Its first delivery contains:

- a clear Super Admin heading and signed-in identity
- a **Store Managers** section
- counts for active managers and pending invitations
- an **Add Store Manager** action
- a searchable active and pending manager list
- a link to open the store-manager workspace
- sign-out

The navigation is separate from the store-manager sidebar. Future shared administration modules can be added without coupling them to catalog or inventory internals.

## Dynamic store-manager provisioning

The **Add Store Manager** flow accepts a valid college email and optional display name.

If the email belongs to an existing confirmed account, the operation assigns `store_manager` immediately.

If no account exists, the operation:

1. creates a pending store-manager invitation;
2. sends a Supabase Auth invitation to the college email;
3. shows the invitation as pending; and
4. assigns `store_manager` only after the invited account is confirmed.

The screen supports:

- search by email or display name
- listing active managers
- listing pending invitations
- resending a pending invitation
- cancelling a pending invitation
- removing `store_manager` from an active user

Invitation and assignment operations are idempotent. Repeating the same valid request does not create duplicate invitations or duplicate role rows.

Initial super admins remain configured through the server-only comma-separated `INITIAL_SUPER_ADMIN_EMAILS` value. This interface manages store-manager access; it does not create or remove super admins.

## Authorization and database ownership

The database is authoritative for role assignment and invitation state.

A private invitation table stores:

- normalized college email
- optional display name
- invitation state
- inviter
- invited, resent, cancelled, accepted, and updated timestamps
- the matched user ID after acceptance

Only server-side code using the Supabase secret key can call Auth administration APIs. Database functions that assign or remove `store_manager`:

- require an authenticated `super_admin`
- validate the target user
- prevent arbitrary role names
- update trusted role storage
- synchronize trusted application metadata when required by the shared auth contract
- write an audit event in the same operation

The browser never receives the Supabase secret key and never writes private role tables directly.

## Audit history

Audit events cover:

- `store_manager.invited`
- `store_manager.invitation_resent`
- `store_manager.invitation_cancelled`
- `store_manager.assigned`
- `store_manager.removed`

Events identify the acting super admin, target email or user, source operation, and resulting state. Audit records remain append-only.

## Minimal student landing

`/dashboard` is intentionally small because student-store and printing experiences belong to other modules.

It contains only:

- a Student / Customer heading
- the signed-in display name or college email
- a short message confirming the user is signed in as a student or customer
- a sign-out action
- an optional friendly notice when redirected from an unauthorized manager route

It does not show unfinished feature cards, fake metrics, sample orders, or controls owned by another module.

## Error behavior

- Invalid or non-college invitation email: reject without creating an invitation.
- Existing store manager: return the current active state without duplicating data.
- Existing pending invitation: show its state and offer resend or cancel.
- Cancelled invitation: allow a new invitation through an explicit action.
- Auth invitation failure: retain no misleading active-manager state and show a retryable error.
- Role-assignment failure after confirmation: retain a recoverable pending state and expose the failure to server logs without leaking credentials.
- Last configured super admin: unaffected because this interface cannot remove super-admin access.

## Shared contracts touched

| Contract | Responsibility |
|---|---|
| `auth` | authenticated user lookup, confirmation, sign-in, and sign-out |
| `authorization` | authoritative roles, route precedence, and capability guards |
| `super-admin` | manager invitation and access-management composition |
| `store-manager` | store workspace capability boundary |
| `student landing` | minimal fallback workspace for non-manager users |
| Supabase Auth administration | server-only invitations and user lookup |
| Supabase Postgres | invitation state, role mutations, row security, and audit events |

## Verification

Automated verification covers:

- route precedence for users with one or multiple roles
- login, confirmation, and root-route destinations
- friendly cross-role redirects
- super-admin-only dashboard access
- immediate promotion of an existing confirmed user
- invitation and later assignment of a new user
- resend, cancel, and removal behavior
- idempotent repeated operations
- authorization denial for store managers, students, print admins, and anonymous callers
- audit-event creation
- absence of unfinished module controls on the student landing

Manual browser verification covers super-admin login, manager creation, manager login, student login, cross-role URL entry, notices, and sign-out.

## Completion criteria

Implementation is complete when:

1. every authentication entry point uses the same authoritative role-aware destination;
2. super admins land on `/super-admin`;
3. store managers land on `/store-manager/products`;
4. all other authenticated users land on `/dashboard`;
5. super admins can invite, assign, find, resend, cancel, and remove store managers;
6. role and invitation mutations are authorized and audited in the database;
7. valid users are not sent back to login merely because they opened the wrong workspace;
8. the student landing remains intentionally minimal; and
9. fresh schema, unit, integration, browser, type, lint, and build verification passes.
