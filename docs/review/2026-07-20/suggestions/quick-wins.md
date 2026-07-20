# Prioritized Suggestions

Ordered by (impact ÷ effort). References point into `../findings/`.

## Do first (small effort, high impact)

1. **Add the missing CSS classes** — super-admin badges, categories rule
   list, media order form ([06 F1](../findings/06-categories-super-admin-student.md#f1),
   [04 F2](../findings/04-products-catalog.md#f2)). Pure CSS, ~30 lines,
   fixes two visibly broken screens.
2. **Shared `SubmitButton` with `useFormStatus`** — pending label +
   disable during request; adopt in auth, product, variant, stock,
   category, and super-admin forms
   ([02 F3](../findings/02-auth-public.md), 04 F6). One component,
   app-wide double-submit protection and feedback.
3. **Sidebar `aria-current` + active style**
   ([03 F1](../findings/03-manager-shell-navigation.md#f1)). Small client
   nav component; biggest orientation win in the manager UI.
4. **Load Inter via `next/font` (or delete it from the stack)**
   ([01 F1](../findings/01-global-foundations.md)).
5. **Per-page `metadata` titles + title template** (01 F2).
6. **Fix heading order on `/auth`** — swap intro to `h1`, card to `h2`
   (02 F1). Two-line change.
7. **`timeZone: "Asia/Kolkata"` in both `DATE_TIME_FORMAT`s** (04 F10).
8. **Success-notice consistency** — always `notice is-success` (05 F5).
9. **Favicon via `app/icon.svg`** (01 F6).
10. **Delete duplicated `overscroll-behavior` lines** (01 F11).

## Do soon (medium effort, prevents real damage)

11. **Stop wiping the product draft on server error** — convert
    `createProduct` to `useActionState` result unions; redirect only on
    success ([04 F1](../findings/04-products-catalog.md#f1)). The
    result-union pattern is already mandated by the foundation (§8) and
    already used by the inline panels — this aligns the outlier.
12. **Make side panels real modals** — native `<dialog>.showModal()` or
    focus trap + `inert` ([04 F3](../findings/04-products-catalog.md#f3)).
13. **Batch the catalog usage RPC** — one set-returning call
    ([06 F2](../findings/06-categories-super-admin-student.md#f2)).
    Requires migration + `main_schema.sql` update + foundation review.
14. **Server-side filtering + pagination** for products and inventory
    (04 F4, 05 F1) and a limit on variant movement history (05 F2).
15. **`loading.tsx` / `error.tsx` / `not-found.tsx`** for the manager and
    super-admin route groups (01 F3).
16. **Password reset flow** (02 F4).
17. **Unify the add/reduce stock mental model around deltas** (05 F3).
18. **Replace `__new_*` sentinel select options with adjacent `+ New`
    buttons** (04 F7).

## Nice to have (polish batch)

19. Table semantics (or row `aria-label`s) for the div-grid tables
    (04 F5).
20. Skip link + `100dvh` + `text-wrap: balance` + `tabular-nums` +
    120 ms color transitions (01 F5, F7–F10).
21. Collapsible mobile nav for the manager shell (03 F2); promote
    Counter sale in the nav once the basket ships (03 F3).
22. Auth polish: `spellCheck={false}`, password hint + show toggle,
    clear stale notices on mode switch, tab hover state, complete or
    drop the ARIA tab roles (02 F2, F5–F8).
23. Confirm/undo for removing a filled variant row (04 F8); price input
    pattern validation (04 F9).
24. Categories page parity with inline panels (06 F3); admin removal
    copy with consequence + recovery (06 F4); filtered-count clarity in
    manager search (06 F5).
25. Student landing: signposted "coming soon" module cards (06 F7).
26. Dark-mode decision: either declare light-only with `theme-color`,
    or variable-ize the palette first (01 F4).

## Suggested process guards

- **JSX↔CSS class audit in CI** — a tiny script that extracts
  `className` literals and diffs them against `globals.css` selectors
  would have caught findings 04 F2 and 06 F1 before merge.
- **Add E2E credentials (`E2E_MANAGER_EMAIL`/`PASSWORD` etc.) to a local
  `.env`** so future audits and the existing Playwright specs can
  exercise the authenticated UI — this audit had to review those screens
  from source only.
- **Screenshot-on-PR habit** — the team guide already requires
  screenshots for UI changes; wiring the Playwright screenshot script
  from this audit (`ui-audit.mjs` approach) into a repeatable
  `pnpm audit:ui` would make that cheap.
