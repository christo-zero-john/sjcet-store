# UI/UX Audit — 2026-07-20

A full user-interface audit of the SJCET Store web application covering
visual design, interaction design, accessibility, responsive behavior,
typography, performance-affecting UI patterns, and copy.

## Scope and method

- **Live review:** Public routes (`/`, `/auth`) were exercised in a real
  Chromium browser through Playwright at desktop (1440×900) and mobile
  (390×844) viewports. Screenshots are in [`screenshots/`](screenshots/).
  Redirect behavior, heading structure, meta tags, focus visibility, and
  horizontal-overflow checks were verified live.
- **Code review:** All protected routes (store-manager, super-admin,
  student dashboard) were audited from source because no E2E credentials
  are configured in this environment. Every page under `client-side/app/`
  and every component under `client-side/features/` with UI output was
  read in full, along with `client-side/app/globals.css`.
- **Rule set:** Vercel Web Interface Guidelines (fetched fresh on the
  audit date), the accessibility and non-functional requirements in
  `docs/architecture/project-foundation.md` §10, and general visual/UX
  heuristics.

## Severity legend

| Level | Meaning |
|---|---|
| 🔴 High | Data loss, broken visual, or accessibility blocker; fix before next release |
| 🟠 Medium | Real usability/a11y/perf cost; schedule soon |
| 🟡 Low | Polish, consistency, or minor guideline deviation |

## Findings by area

| Doc | Area | High | Medium | Low |
|---|---|---:|---:|---:|
| [01-global-foundations](findings/01-global-foundations.md) | Theme, typography, meta, app-wide patterns | 1 | 5 | 5 |
| [02-auth-public](findings/02-auth-public.md) | `/auth` login + signup | 0 | 4 | 4 |
| [03-manager-shell-navigation](findings/03-manager-shell-navigation.md) | Store-manager layout & nav | 0 | 3 | 2 |
| [04-products-catalog](findings/04-products-catalog.md) | Product list, add-product form, product detail, side panels | 2 | 6 | 5 |
| [05-inventory](findings/05-inventory.md) | Inventory list & variant detail | 0 | 3 | 3 |
| [06-categories-super-admin-student](findings/06-categories-super-admin-student.md) | Catalog settings, super-admin, student landing | 2 | 3 | 3 |

Prioritized fixes with suggested implementations:
[suggestions/quick-wins.md](suggestions/quick-wins.md).

## Top findings (read these first)

1. 🔴 **A failed product submission destroys the manager's entire draft.**
   `createProduct` redirects to `/store-manager/products/new?error=…` on any
   server-side validation failure, remounting the client form with empty
   state — variants, options, and images all lost. See
   [04-products-catalog](findings/04-products-catalog.md#f1).
2. 🔴 **Several class names used in JSX have no CSS at all**, so the
   super-admin status badges (`is-active`, `is-pending`, `is-error`), the
   categories-page rule list (`configuration-list`, `attribute-heading`,
   `attribute-value`), and the media-editor order form render unstyled.
   See [06](findings/06-categories-super-admin-student.md#f1) and
   [04](findings/04-products-catalog.md#f2).
3. 🔴 **Side panels are `role="dialog"` without dialog behavior** — no
   focus trap, no initial focus move, background not inert. Keyboard and
   screen-reader users can tab out of a modal into the obscured page.
   See [04-products-catalog](findings/04-products-catalog.md#f3).
4. 🟠 **No per-page titles, no loading/error boundaries, no favicon, no
   dark-mode strategy, and the declared Inter font is never loaded.**
   See [01-global-foundations](findings/01-global-foundations.md).
5. 🟠 **Sidebar navigation never indicates the current page** (no
   `aria-current`, no active styling).
   See [03-manager-shell-navigation](findings/03-manager-shell-navigation.md#f1).
6. 🟠 **Catalog settings issues one usage RPC per attribute type and per
   value** — page latency grows linearly with catalog size and will blow
   the 500 ms p95 budget quickly.
   See [06-categories-super-admin-student](findings/06-categories-super-admin-student.md#f2).

## What is already good

Credit where due — the codebase gets a lot right:

- Global `:focus-visible` outline (3 px, offset) on all interactive
  elements, verified visible live; `touch-action: manipulation` and
  intentional tap-highlight reset.
- Labels wrap their inputs everywhere; correct `autocomplete`,
  `inputmode`, and `type` on auth and money/stock fields; paste is never
  blocked.
- Destructive actions consistently gated behind confirmation
  (`ConfirmSubmitButton`, `window.confirm` on detach/remove) and
  server-side idempotency keys for stock mutations.
- Filters, sort, and state live in the URL (`?q=&category=&state=&sort=`)
  — pages are deep-linkable and refresh-safe.
- `details`/`summary` used for progressive disclosure — natively
  keyboard-accessible with no JS.
- Empty states exist on every list (products, inventory, movements,
  categories, manager search).
- Product images get explicit `width`/`height`, `loading="lazy"`, and an
  alt-text field in the upload form.
- `Intl.DateTimeFormat` and a shared paise formatter instead of hand-rolled
  date/money strings; `aria-live="polite"` on async panels; Escape closes
  panels; `overscroll-behavior: contain` on the drawer.
- Sensible responsive breakpoints; the live mobile run showed no
  horizontal overflow on public pages.

## Contract note

Per the repository rule to state touched shared contracts: this audit is
documentation-only. No code, schema, or shared contract was changed. All
suggestions that would touch shared foundations (root layout, globals.css,
auth form) need foundation review per `docs/team/development-guide.md` §2.
