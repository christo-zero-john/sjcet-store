# 01 — Global Foundations

Files: `client-side/app/layout.tsx`, `client-side/app/globals.css`,
`client-side/app/page.tsx`.

## 🔴 High

### F1. Declared brand font is never loaded
`globals.css:9-11` lists `Inter` first in the font stack, but nothing ever
loads Inter — there is no `next/font` usage and no `@font-face`. Every
user silently falls back to Segoe UI / system-ui (confirmed in live
screenshots), so the designed typography never ships and the intended
look differs per OS.

**Suggestion:** load it properly in `app/layout.tsx`:

```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap" });
// <body className={inter.className}>
```

`next/font` self-hosts the file, preloads it, and applies
`font-display: swap` — satisfying the critical-font guideline with no
external requests. (If system fonts are actually the intent, remove
`Inter` from the stack so the declaration matches reality.)

## 🟠 Medium

### F2. Every page has the same `<title>`
`layout.tsx:6-9` defines the only metadata in the app. Products,
Inventory, Auth, Super Admin — all render as "SJCET Store" in tabs,
history, and screen-reader page announcements.

**Suggestion:** add a title template in the root layout
(`title: { default: "SJCET Store", template: "%s · SJCET Store" }`) and
`export const metadata = { title: "Products" }` (etc.) in each page file.

### F3. No `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere
All manager pages are server components doing multi-query Supabase reads.
During navigation the old page just freezes until the new one streams in;
an unexpected error surfaces Next's unstyled default; `notFound()` calls
(product/variant detail) render the framework fallback.

**Suggestion:** add a minimal `app/store-manager/loading.tsx` (skeleton of
`page-header` + card), a branded `error.tsx` with a retry button, and a
`not-found.tsx` that links back to the products list.

### F4. No dark-mode strategy
`globals.css:2` pins `color-scheme: light` and all ~80 colors are
hardcoded hex values; a handful of components use `--background`/
`--surface` vars but most don't. There is no
`prefers-color-scheme` handling and no `theme-color` meta (verified
MISSING live). Users on dark OS themes get a white flash and mismatched
browser chrome.

**Suggestion:** either commit to light-only explicitly (add
`<meta name="theme-color" content="#f4f7f3">` and keep
`color-scheme: light`) — acceptable for a POS tool — or migrate the
palette to the existing CSS variables and add a dark block. Migrating to
variables first makes the choice reversible; the current half-and-half
usage (raw hex in most rules, `var(--border)` in super-admin rules) should
be unified regardless.

### F5. No skip link and no `<h1>` landmark strategy
`layout.tsx` renders `<body>{children}</body>` with no skip-to-content
link. Manager pages have long sidebars before `<main>`; keyboard users
must tab through the full nav on every page.

**Suggestion:** add a visually-hidden-until-focused
`<a href="#main">Skip to content</a>` in the root layout and
`id="main"` on each `<main>`/`.manager-main`.

### F6. No favicon / app icon
There is no `app/icon.*` or `favicon.ico`; browsers show the default
document icon next to "SJCET Store".

**Suggestion:** add `client-side/app/icon.svg` (the green "SJCET" mark
works at 32 px) — Next serves and links it automatically.

## 🟡 Low

### F7. `min-height: 100vh` instead of `100dvh`
`globals.css:21` (`body`), plus `.auth-page`, `.manager-layout`,
`.student-landing`, `.super-admin-shell`. On mobile browsers `100vh`
overshoots behind the collapsing URL bar.
**Suggestion:** `min-height: 100dvh` (keep `100vh` as fallback line above).

### F8. No hover/active transitions anywhere
Buttons snap between states (`.primary-button:hover` at
`globals.css:204`). A 120–150 ms `transition: background-color, color`
(never `transition: all`) makes the UI feel finished; with no animations
in the app, `prefers-reduced-motion` handling is currently moot but add it
alongside any future motion.

### F9. Numeric columns don't use tabular figures
Stock counts, prices, and movement deltas (product table, inventory
table, history rows) shift width per digit.
**Suggestion:** `font-variant-numeric: tabular-nums` on
`.product-table-row`, `.history-row`, `.summary-card strong`,
`.detail-list dd`.

### F10. Headings don't opt into balanced wrapping
Large clamped headings (`.auth-intro h2`, `.page-header h1`) can wrap
awkwardly at intermediate widths.
**Suggestion:** `text-wrap: balance` on heading rules.

### F11. Duplicated declaration
`globals.css:964,970,971` — `overscroll-behavior: contain` appears three
times in `.side-panel-content`. Harmless; delete two.
