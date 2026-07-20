# Super Admin Requirements

## Purpose

The super-admin workspace owns trusted platform administration. It does not
replace module workspaces and is the default destination only for users with
the `super_admin` role.

## Routing and access

- A super admin lands on `/super-admin` after login or email confirmation.
- Only a super admin may open `/super-admin` or perform its mutations.
- A super admin may deliberately enter `/store-manager/products`, but that is
  not their default landing page.
- Every administrative mutation is server-authorized and audited.

## Store-manager access

The super-admin dashboard provides one Store Manager Management panel:

- add a manager using a valid SJCET college email;
- assign `store_manager` immediately when the Auth account already exists;
- invite an unregistered user and show the invitation as pending;
- assign `store_manager` after the invited, confirmed account signs in;
- list and search active managers and pending invitations;
- explicitly resend or cancel a pending invitation;
- remove store-manager access without deleting the user account; and
- audit invitation, resend, cancellation, assignment, and removal events.

The browser never receives `SUPABASE_SECRET_KEY`. Auth administration happens
only in a super-admin-authorized Server Action, while role assignment remains
authoritative in the database.

## Acceptance

1. A super admin signs in and reaches `/super-admin`.
2. Adding an existing confirmed user makes that user an active store manager.
3. Adding an unknown email creates a pending invitation.
4. A confirmed invitee receives `store_manager` when authorization is
   synchronized.
5. A student or store manager cannot list, invite, or remove managers.
6. Removing manager access redirects that user to the student/customer landing
   page on their next role check.
