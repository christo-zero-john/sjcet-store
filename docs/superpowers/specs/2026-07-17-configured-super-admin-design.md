# Configured Super-Admin Synchronization

## Problem

New Supabase accounts correctly receive only the `student` role, but the
application previously had no way to grant the first privileged role. A valid
configured administrator therefore entered a login-to-authorization loop.

## Design

`INITIAL_SUPER_ADMIN_EMAILS` is a server-only, comma-separated list of college
email addresses. Entries are trimmed, normalized to lowercase, and deduplicated.

When an authenticated user enters a store-manager route, the server uses
`SUPABASE_SECRET_KEY` to call one narrowly scoped database authorization
function with the session-validated user ID and whether the email matched the
configured list. In one transaction, the function optionally adds
`super_admin`, records an audit event, and returns the user's authoritative
role array. The application does not combine a user-context role read with a
separate service-context role write.

The browser never receives the configured list or secret key. Unlisted users
cannot invoke the privileged operation through the application. Removing an
email from the environment does not silently revoke an already assigned role;
role revocation remains an explicit audited administrative action.

## Verification

Unit tests cover list parsing, normalization, deduplication, and matching.
Application verification covers tests, type checking, linting, schema
structure, and production compilation. Executing the function against a fresh
database remains a separate local Supabase database gate.
