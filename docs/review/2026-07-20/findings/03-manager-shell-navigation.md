# 03 — Store-Manager Shell & Navigation

Files: `client-side/features/store-manager/manager-shell.tsx`,
`client-side/app/store-manager/layout.tsx`, sidebar rules in
`client-side/app/globals.css:231-303,882-894`.

## 🟠 Medium

### F1. No current-page indication in the sidebar
`manager-shell.tsx:39-48` renders every nav link identically — no
`aria-current="page"`, no active background. A manager on Inventory sees
five equally styled links and must remember where they are. This is the
single biggest orientation gap in the manager UI.

**Suggestion:** the shell is a server component receiving no path; either
make the nav a small client component using `usePathname()`, or pass the
active segment from the layout. Style
`a[aria-current="page"] { background: #1a3827; color: #fff; }` — the
hover style already exists to reuse.

### F2. Mobile navigation is always fully expanded
At ≤58rem the sidebar becomes a static block stacked above content
(`globals.css:1283-1294`): brand + 6 links + account section push the
actual page content a full viewport down on every page.

**Suggestion:** on small screens collapse to a top bar with a
`<details>`-based disclosure (no-JS friendly, matches the codebase's
existing `details` idiom) or a horizontal scrollable link row. Keep the
account/sign-out inside the disclosure.

### F3. "Counter sale" placement breaks scent
`manager-shell.tsx:19` lists Counter sale *after* Payments inside "Daily
work", yet it is the primary POS action per
`docs/requirements/store_manager.md`. It's also a duplicate destination
of Orders → New. Once the order-basket plan ships, this becomes the most
used button in the app.

**Suggestion:** promote Counter sale to the first item (or a visually
distinct primary button above the nav groups), and keep Orders as the
history view.

## 🟡 Low

### F4. Sign-out is an unstyled bare-text button
`globals.css:293-299` — `.manager-account button` is transparent,
padding-less white text; hit target is well under 44 px and it reads as
plain text next to the email.
**Suggestion:** give it `.text-button`-like padding and an underline or
border on hover; `min-height: 2.25rem`.

### F5. Long emails wrap awkwardly in the account block
`word-break: break-word` (`globals.css:290`) will split
`firstname.lastname@2026.cse.sjcetpalai.ac.in` mid-token.
**Suggestion:** `overflow-wrap: anywhere` plus `title={userEmail}` and a
single-line `text-overflow: ellipsis` treatment; the full value is rarely
needed.

## ✓ Good

- `<nav aria-label="Store manager">` landmark; grouped headings
  ("Daily work" / "Maintenance") are a nice IA touch.
- Sticky full-height sidebar with `min-width: 0` main column — no
  overflow traps.
- Brand link returns to the module root.
