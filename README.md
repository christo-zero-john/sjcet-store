# SJCET Store

SJCET Store is a shared web platform for the college store and print services at St. Joseph's College of Engineering and Technology, Palai. This repository contains one Next.js application with shared authentication, authorization, payments, audit trails, and module-specific workflows.

## Current status

The project has a runnable application scaffold and a reviewed implementation plan. Store, print, and administration workflows remain under development.

| Area | Status |
|---|---|
| Next.js application scaffold | Complete |
| Shared architecture and team rules | Complete |
| Shared environment and money contracts | Implemented |
| Combined Supabase authentication and roles | Implemented |
| Dynamic catalog and variant inventory | Implemented |
| Store orders and payment workflows | Planned |
| Cash and Dodo Payments checkout | Planned |
| Student store, print, and super-admin modules | Requirements pending |

Follow progress in the [shared foundation and store-manager implementation plan](docs/superpowers/plans/2026-07-17-shared-foundation-store-manager.md).

## Platform modules

The application separates five user-facing modules while sharing one backend foundation:

- **Store manager**: configure dynamic categories and attributes, manage product variants and stock, create counter orders, collect cash, generate online checkout links, and print bills
- **Student store**: browse and purchase store products
- **Print admin**: manage print requests and print-service settings
- **Print student**: submit and track print requests
- **Super admin**: manage roles, shared settings, and administrative access

The [store-manager requirements](docs/requirements/store_manager.md) define the first detailed module. Other module requirement files will expand as their owners finalize workflows.

## Technology

- Next.js 16 with the App Router
- React 19 and TypeScript 5
- Supabase Postgres, Auth, and Row Level Security (RLS)
- Dodo Payments Checkout Sessions and verified webhooks
- Vitest for unit and integration tests
- Playwright for browser acceptance tests
- pnpm lockfile for reproducible dependency installation

Pinned versions and architectural constraints live in the [shared project foundation](docs/architecture/project-foundation.md).

## Repository layout

```text
client-side/                 Next.js application
  app/                       Routes, layouts, and external HTTP boundaries
  features/                  Shared and module-owned business features
  lib/                       Environment, money, validation, and clients
  tests/                     Browser tests and shared fixtures
docs/
  architecture/             Cross-module technical authority
  requirements/             Product requirements by module
  supabase/                  Complete local Supabase project and canonical schema
  superpowers/plans/         Executable implementation plans
  team/                      Contribution and ownership rules
.agents/skills/              Project-local Codex skills
.claude/skills/              Project-local Claude Code skills
AGENTS.md                    Mandatory instructions for coding agents
CLAUDE.md                    Claude Code entry point
skills-lock.json             Installed skill sources and hashes
```

Keep the web application inside `client-side/` and the complete local Supabase project inside `docs/supabase/`. Keep shared documentation and agent configuration at the repository root.

## Run the application

### Prerequisites

Install these tools before starting:

- Node.js
- pnpm
- Docker Desktop and the Supabase command-line interface when database tasks begin

### Install dependencies

Run application commands from `client-side/`:

```powershell
cd client-side
pnpm install --frozen-lockfile
```

### Configure environment variables

Copy the example file and add development credentials:

```powershell
Copy-Item .env.example .env.local
```

`client-side/.env.example` documents these values:

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Server only | Narrow privileged operations |
| `INITIAL_SUPER_ADMIN_EMAILS` | Server only | Comma-separated accounts synchronized as `super_admin` |
| `DODO_PAYMENTS_API_KEY` | Server only | Create hosted checkout sessions |
| `DODO_WEBHOOK_SECRET` | Server only | Verify Dodo webhook signatures |
| `DODO_PAYMENTS_ENVIRONMENT` | Server only | Select `test_mode` or `live_mode` |
| `DODO_DYNAMIC_PRODUCT_ID` | Server only | Dodo one-time dynamic-price product |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Application origin |

Never commit `.env.local`. Never prefix a secret with `NEXT_PUBLIC_`.

Configure initial super administrators as a comma-separated list:

```env
INITIAL_SUPER_ADMIN_EMAILS=admin1@store.sjcetpalai.ac.in,admin2@cse.sjcetpalai.ac.in
```

When a listed, confirmed account enters a protected manager route, the server
idempotently synchronizes its `super_admin` role using
`SUPABASE_SECRET_KEY`. Unlisted accounts keep their existing roles.

### Start development

```powershell
yarn dev
```

Open `http://localhost:3000`.

## Verify changes

Run the checks that match your change before opening a pull request:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Database and browser tasks will also run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs test db
pnpm test:e2e
```

Do not report a database or browser gate as passing until its supporting tests exist and run successfully.

`docs/supabase/main_schema.sql` is the canonical database setup script.
It creates the current schema from an empty Supabase database. Every migration
must update this script in the same change, but migration history and seed data
must never be copied into it.

## Authentication policy

Public signup accepts college email addresses with one or more subdomains before `sjcetpalai.ac.in`.

Accepted:

- `student@cs.sjcetpalai.ac.in`
- `student@2026.cse.sjcetpalai.ac.in`

Rejected:

- `student@sjcetpalai.ac.in`
- `student@gmail.com`
- `student@fake-sjcetpalai.ac.in`

The application enforces this policy in the form, server action, and Supabase
Before User Created hook. Email confirmation is required, and anonymous signup
is disabled.

## Store-manager inventory

Authorized store managers and super admins can create product families and
multiple independently priced variants, edit product and variant details,
archive or restore records, search and filter inventory, monitor low/out-of-stock
items, record reasoned stock adjustments, and review immutable movement history.

Catalog definitions and inventory movements are separate feature boundaries.
Orders will consume their contracts; payments will consume frozen order totals
without directly editing product or stock records.

## Payment model

The application calculates order totals on the server and stores money as integer paise. For online counter sales, the server creates a Dodo Payments Checkout Session with the exact frozen order total.

A return URL never confirms payment. Only a verified, amount-matched, idempotently processed `payment.succeeded` webhook can mark an order paid and deduct stock. Cash checkout records the amount received and calculates change before manager confirmation.

Read the full contracts in the [store-manager requirements](docs/requirements/store_manager.md) and [shared project foundation](docs/architecture/project-foundation.md).

## Contribute

This repository supports 5–8 contributors working across separate modules. Before changing code:

1. Read [AGENTS.md](AGENTS.md).
2. Read the [shared project foundation](docs/architecture/project-foundation.md).
3. Read the relevant module requirements.
4. Read the [team development guide](docs/team/development-guide.md).
5. Read the active implementation plan.
6. Load each project skill that matches the task.

Use a branch named `type/module-short-description`. Keep pull requests focused on one independently testable outcome. Shared auth, database migrations, RLS, payments, and architecture changes require two reviewers.

Do not make remote Supabase, Dodo Payments, deployment, or production-data changes without explicit authorization.

## Agent skills

Project-local skills support both Codex and Claude Code. Installed skills cover planning, test-driven development, debugging, verification, React and Next.js, web-interface review, documentation review, Supabase and Postgres, and repository context.

Agents must inspect third-party skills before use, select skills by their trigger descriptions, and treat repository requirements as the final authority. `skills-lock.json` records each installed source and content hash.

## Documentation authority

When documents conflict, use this order:

1. Accepted architecture decision records
2. [Shared project foundation](docs/architecture/project-foundation.md)
3. Module requirements
4. Active implementation plan
5. Code comments

Update affected requirements and architecture documents in the same change when a shared contract changes.
