# 06 — Catalog Settings, Super Admin, Student Landing

Files: `client-side/app/store-manager/categories/page.tsx`,
`app/super-admin/{layout,page}.tsx`,
`features/super-admin/manager-access-panel.tsx`,
`features/student/student-dashboard.tsx`,
`features/store-manager/module-placeholder.tsx`.

## 🔴 High

<a id="f1"></a>
### F1. Unstyled classes break two screens' visuals
None of these classes exist in `globals.css`:

- `status-badge is-active`, `is-pending`, `is-error`
  (`manager-access-panel.tsx:115,139-145`) — super-admin state badges
  render as colorless pills: "Active", "Pending", and **"Send failed"**
  are visually identical, defeating the point of a status badge. The
  error state especially needs the red treatment.
- `empty-state` (`manager-access-panel.tsx:173`) — unstyled paragraph.
- `configuration-list`, `attribute-heading`, `attribute-value`
  (`categories/page.tsx:338,188,216`) — the "Category parameters" rule
  list has no layout: each article's name block and Remove form stack
  with no spacing/border, and attribute-value chips lose their pill
  styling (`attribute-list article span` styles the *other* span
  pattern, so the inline remove forms inside chips also misalign).

**Suggestion:** add the missing rules (map `is-active`→ the existing
`is-healthy` colors, `is-pending`→ `is-low` colors, `is-error`→ `is-out`
colors; style `configuration-list` like `category-parameter-row`), and
adopt the JSX↔CSS class-diff lint suggested in doc 04 F2 so this class of
bug can't silently recur.

<a id="f2"></a>
### F2. Categories page fires one RPC per attribute type and per value
`categories/page.tsx:78-98` awaits `get_catalog_option_usage` once for
every attribute type **and** every attribute value. A modest catalog
(10 types × 8 values) is ~90 sequential-ish network round trips per page
view — this will dominate page latency and badly miss the 500 ms p95
budget.

**Suggestion:** add a set-returning variant of the function (one call
returning usage for all types/values) or a view joined in the main
query. This is a database contract change — follow the migration +
`main_schema.sql` rules and foundation review.

## 🟠 Medium

### F3. Categories page can't edit or archive anything it lists
The page renders the tree and attribute lists read-only with add-only
forms; rename/description-edit/archive for categories, and value rename,
exist only inside the *product form's* inline panels. A manager doing
catalog maintenance lands on "Catalog settings" and cannot fix a typo'd
category name there. The two surfaces also duplicate creation flows with
different capabilities (inline panel supports parameters at creation;
this page's form doesn't).

**Suggestion:** reuse `CategoryInlinePanel`/`ProductOptionInlinePanel`
here (they are already standalone client components) so both surfaces
expose the same operations, or clearly signpost "Edit categories from a
product form" until parity ships.

### F4. Super-admin remove access lacks safeguards against self-lockout copy
`manager-access-panel.tsx:117-130` — confirm text is generic
(`Remove store-manager access from X?`). Removal is role-destructive and
its consequence (user loses the whole workspace immediately) isn't
stated; there is also no undo path surfaced (re-add exists, but the
dialog doesn't say so).

**Suggestion:** confirmation copy that states consequence + recovery:
"X will immediately lose the store-manager workspace. You can re-add
them later." Error-message guideline: include the next step.

### F5. Search filters silently exclude the summary counts
`manager-access-panel.tsx:104-107` — "3 active · 2 pending" always shows
totals while the list below is filtered; with a narrow query users see
"3 active" above one row. Also the search input is not debounced but
that's fine client-side; the count/list mismatch is the confusion.

**Suggestion:** when a query is active, show "1 of 3 active" or filter
the summary too; add `aria-live="polite"` to the result count so AT
hears filtering results.

## 🟡 Low

### F6. Duplicate-looking nav links in super-admin bar
`super-admin/layout.tsx:19-22` — "User access" (self-link on the only
page) and "Open store manager" sit as identical links. Self-link should
carry `aria-current="page"`; "Open store manager" is a context switch
that deserves button styling or an external-ish affordance since it
leaves the admin area.

### F7. Student landing dead-ends
`student-dashboard.tsx` — the card offers email + sign out only; no link
to the (future) store or print modules, not even disabled "coming soon"
entries. A student logging in today reasonably concludes the product is
broken. Placeholder affordances (like the manager module placeholders
do) would set expectations.

### F8. `×` remove button relies on `aria-label` alone — good — but the
chip it sits in is a `<span>` housing a nested `<form>`
(`categories/page.tsx:216-245`), producing spans containing block forms.
Legal HTML, but the pill hit-target is tiny (0.72rem text ×). Give the
button explicit ~1.5rem square sizing.

## ✓ Good

- Removal buttons disable with a `title` explaining *why* ("Used by 4
  products and 2 categories") — great guarded destruction.
- Search input has a real visible label; `type="search"`.
- Notices carry `aria-live="polite"` on the super-admin page.
- Student/manager/admin shells all keep the same visual language.
