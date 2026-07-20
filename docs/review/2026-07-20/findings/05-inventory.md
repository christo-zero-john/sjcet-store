# 05 — Inventory

Files: `client-side/app/store-manager/inventory/page.tsx`,
`inventory/[variantId]/page.tsx`,
`features/store-manager/add-stock-panel.tsx`,
`stock-reduction-panel.tsx`, `features/inventory/*`.

## 🟠 Medium

### F1. Whole-table fetch with client-side filtering (same as products)
`inventory/page.tsx:52-56` selects every variant with nested product,
category, and attribute joins, then filters/sorts in JS and *also*
recomputes the summary counts from the same full array. No `order` on
the query and no pagination. Costs grow with catalog size; the summary
cards only need three counts the database can return directly.

**Suggestion:** move status filtering into the query (or a view), use
`count: "exact", head: true` queries or one RPC for the three summary
numbers, and paginate the table.

### F2. Variant detail loads unbounded movement history
`inventory/[variantId]/page.tsx:90-96` has no `.limit()` — a
high-traffic SKU renders hundreds of ledger rows into the DOM (the
product page correctly limits to 100).

**Suggestion:** `.limit(50)` plus a "Show older movements" link
(URL-driven `?before=` cursor keeps it deep-linkable).

### F3. Add-stock slider and number input disagree about intent
`add-stock-panel.tsx:23-61`: the model is "set the new total count"
(minimum `currentStock + 1`), while the panel title says "Add stock" and
managers think in deltas ("add 25"). The slider's max grows dynamically
via `sliderMaximum`, which is clever but unpredictable. The reduction
panel, by contrast, correctly asks for a delta ("Quantity to remove") —
the two panels use opposite mental models for mirror operations.

**Suggestion:** make both delta-based: "Units to add" input, live
"New total: N" `aria-live` line (already present, inverted). Keep the
target-count math server-side.

## 🟡 Low

### F4. Range input duplicates the number input without linkage
`add-stock-panel.tsx:52-61` — the slider has its own `aria-label` but no
`name` (uncontrolled by the form, fine) and is a second tab stop that
does the same job. If kept, wrap both in a `fieldset` ("New stock
count") so AT groups them; or drop the slider — keyboard/PoS use favors
the plain input.

### F5. Inconsistent success-notice styling
`inventory/[variantId]/page.tsx:127` renders success as bare `.notice`
(grey) while `products/[id]/page.tsx:228` uses `.notice is-success`
(green). Same event, two looks.
**Suggestion:** standardize on `is-success`.

### F6. Status vocabulary drift
The inventory filter offers "Needs attention" (`attention`) and the
product list column is "Needs attention", but badges render
"healthy/low/out/archived" (`status-badge` capitalized via CSS). Minor,
but pick one term set and use it in filter, column, and badge; also
"alert at N" vs "/ alert N" vs "Low-stock alert" label the same concept
three ways across pages.

## ✓ Good

- Confirmation checkbox + reason required on stock reduction, `max`
  bound to current stock, and `aria-live` resulting-stock preview —
  strong destructive-action hygiene.
- Idempotency key on every stock mutation form.
- Sibling-variant rail with `aria-current="page"` and sticky positioning
  is a genuinely good navigation pattern.
- Summary cards give the three numbers a manager actually scans for.
