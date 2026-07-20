# 04 — Products & Catalog Authoring

Files: `client-side/app/store-manager/products/page.tsx`,
`products/new/page.tsx`, `products/[id]/page.tsx`,
`features/store-manager/product-form.tsx`, `product-list.tsx`,
`product-variant-rows.tsx`, `variant-form.tsx`,
`product-option-inline-panel.tsx`, `category-inline-panel.tsx`,
`grouped-variant-editor.tsx`, `product-media-editor.tsx`.

## 🔴 High

<a id="f1"></a>
### F1. Server-side failure wipes the entire product draft
`features/catalog/product-actions.ts:24` redirects to
`/store-manager/products/new?error=…` on any failure. The redirect
remounts `ProductForm`, whose state (product name, selected options,
every variant row's SKU/price/stock, chosen images) lives only in client
memory — all of it is gone. A duplicate-SKU error after entering eight
uniform variants costs the manager the whole form. This is the exact
"warn before unsaved changes are lost" guideline, but self-inflicted.

**Suggestion (ordered by effort):**
1. Switch `createProduct` to the `useActionState` pattern already used by
   the inline panels — return `{ ok:false, error }` instead of
   redirecting, so the mounted form keeps its state and shows the error
   inline (focus it). Redirect only on success.
2. Additionally persist the draft (`sessionStorage`, keyed by route) so
   accidental navigation/refresh is also survivable.
3. Add a `beforeunload`/navigation guard while the form is dirty —
   the Cancel link currently discards silently too.

<a id="f2"></a>
### F2. `image-order-form` and other referenced classes have no styles
`product-media-editor.tsx:74` uses `className="image-order-form"`;
`product-form.tsx:520` uses `product-options-card`;
`product-media-editor.tsx:35` uses `product-media-editor` — none exist in
`globals.css`. The order form renders as an unstyled stacked
label/input/button inside each media card (misaligned with the rest of
the card system). See also finding F1 in doc 06 for the same bug class on
other pages.

**Suggestion:** either add the missing rules (a compact
`display:grid; grid-template-columns: 1fr auto; align-items:end` for the
order form) or remove dead class names so the CSS and JSX stay auditable
against each other. Consider a lint step that diffs JSX class names
against `globals.css`.

<a id="f3"></a>
### F3. Side panels claim `role="dialog"` but don't behave like dialogs
`product-option-inline-panel.tsx:138-149` and
`category-inline-panel.tsx:287-298`: `aria-modal="true"` with **no focus
trap, no initial focus move, and no `inert` on the background**. A
keyboard user who opens "Add product option" is still focused on the
trigger button; Tab walks the obscured page behind the overlay, and a
screen reader told "modal" can still reach background content. Escape
handling and the focusable backdrop-as-button are good, but incomplete.

**Suggestion:** replace the hand-rolled overlay with the native
`<dialog>` element + `showModal()` (free focus trap, Escape, top-layer,
`::backdrop`) — smallest correct fix and keeps the current CSS with minor
adjustment. If staying with the div: on mount, focus the panel heading
(`tabIndex={-1}`), trap Tab within the panel, restore focus to the
trigger on close, and set `inert` on the sibling app root while open.

## 🟠 Medium

### F4. All filtering, search, and sort happen after fetching every product
`products/page.tsx:46-83` fetches the entire products table (plus all
variants) and filters/sorts in JS; `inventory` does the same. No
pagination anywhere. Beyond ~a few hundred products this degrades both
p95 (§10 budget) and DOM size (large `.map()` without
virtualization guideline).

**Suggestion:** push `q`/`category`/`state` into the Supabase query
(`.ilike`, `.eq`), add `.range()` pagination with URL-reflected page
number. Server-side count for the header.

### F5. Data tables are divs — no table semantics
`product-list.tsx:32` renders the header row `aria-hidden="true"` and each
product as one `<Link>` of five `<span>`s. Screen-reader users get five
unlabeled values per row and (because the header is aria-hidden) *no*
column names at all. Same pattern on inventory and both history tables.

**Suggestion:** these are true data tables — use `<table>` with `<th
scope="col">` and a link in the first cell (row click can stay via CSS on
the row if desired). Minimum fix: remove `aria-hidden` and give rows
`aria-label={`${name}, ${variants} variants, ${stock} in stock…`}`.

### F6. No pending/disabled state on any catalog form submit
`product-form.tsx:650`, `variant-form.tsx:121`, media upload, category
page forms — all plain submits with no `useFormStatus`. Server actions
here can take a second-plus (image upload, multi-insert product create);
double-click risks duplicate variants/images since these paths have no
idempotency key (stock ops do, catalog writes don't).

**Suggestion:** the shared pending `SubmitButton` from doc 02 F3; keep
buttons enabled until request per guideline, disable + spinner during.

### F7. "＋ Create …" as `<select>` options
`product-form.tsx:371-397,420-439` and `category-inline-panel.tsx:407`
overload selects with `__new_parent__` / `__new_subcategory__` sentinel
options that open panels. Screen readers announce them as data options;
choosing one changes selection focus unexpectedly; if the panel is
cancelled the select visually snaps back with no explanation.

**Suggestion:** move creation to a small `+ New` button beside each
select (the codebase already has `input-with-action` styling for exactly
this composition). Keep the sentinel out of the option list.

### F8. Remove-variant row is destructive with no confirm and no undo
`product-variant-rows.tsx:264-276` deletes a typed row (SKU, price,
stock) instantly. Everything else destructive in the app confirms.
**Suggestion:** confirm when the row is non-empty, or better, guideline
style undo: mark row removed with an inline "Undo" for the session.

### F9. Number-ish fields typed as `type="number"` where they shouldn't be
Barcode uses `inputMode="numeric"` text (correct!), but display order,
opening stock, low-stock threshold use `type="number"` — fine — while
**price** is a bare text input with `inputMode="decimal"` and no
`pattern`/step validation (`product-variant-rows.tsx:216-228`,
`variant-form.tsx:67-76`). "12,50" or "₹10" passes the client and dies on
the server (see F1 consequence).

**Suggestion:** add `pattern="[0-9]+([.][0-9]{1,2})?"` with a title, or
validate on blur and show the inline error next to the field.

## 🟡 Low

### F10. Movement timestamps format in the server's timezone
`products/[id]/page.tsx:87-90` — `Intl.DateTimeFormat("en-IN", …)`
without `timeZone`. Rendered on the server, so times display in the
*deployment region's* zone, not IST. Add `timeZone: "Asia/Kolkata"` (the
store is physical and single-timezone; hardcoding is right here).

### F11. Success/error notices depend on scroll position
Notices render at the top of long pages (`products/[id]/page.tsx:224-229`)
— after archiving a variant far down the page, the redirect lands at the
top; fine — but after `details`-panel actions the message is easy to miss.
Consider anchoring the redirect to the acted-on section
(`#variant-{id}`) with `scroll-margin-top` on the anchor.

### F12. `Generate SKU` disabled state is unexplained
`product-variant-rows.tsx:195-202` — disabled until product name exists,
with no hint. Add `title="Enter a product name first"` and
`aria-disabled` semantics, or leave it enabled and focus the name field
with a message.

### F13. Chip affordance ambiguity in the option list
`product-option-list` chips (`product-form.tsx:548-611`) pair a
chip-button ("Colour · Edit") and a text-button ("Remove from product").
The chip's embedded aria-hidden "Edit" label is good; but two adjacent
buttons with different verbs and identical visual weight to other pills
elsewhere (`.auth-feature-list`, badges) blur the chip = action pattern.
Consider an explicit pencil/× icon pair with `aria-label`s.

### F14. `5 MB` and `⌘`-style pairs unprotected
`product-form.tsx:474` — "up to 5 MB" should be `5&nbsp;MB`
(non-breaking-space guideline). Cosmetic.

## ✓ Good

- Option usage counts with "View products using X" deep links before
  allowing destructive detachment — excellent guarded-destruction UX.
- `aria-live="polite"` on async option-load errors with an explicit
  Retry button (`product-form.tsx:620-636`).
- Variant option membership changes preserve unrelated row data
  (`retainSelectedAttributes`) — thoughtful draft semantics.
- `details`-based editors keep the detail page scannable.
- Images: dimensions + lazy + alt handling all correct.
