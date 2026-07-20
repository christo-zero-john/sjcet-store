# 02 — Auth & Public Pages

Files: `client-side/app/auth/page.tsx`,
`client-side/features/auth/auth-form.tsx`.
Live screenshots: `../screenshots/auth-*.png`.

**Overall:** the strongest screen in the app visually. Confident
typography, clear hierarchy, good form fundamentals (`autocomplete`,
`inputmode`, `type=email`, `minLength`, example-pattern placeholder), and
a clean mobile stack with no overflow. The issues below are mostly
interaction and semantics.

## 🟠 Medium

### F1. Inverted heading order (verified live)
The document renders `H2 "One college store…"` before
`H1 "Welcome back"` (`auth/page.tsx:16` vs `auth-form.tsx:46`). The
page's dominant visual heading is an `h2` that precedes the `h1`,
breaking the hierarchical-headings rule and confusing rotor navigation.

**Suggestion:** make the intro heading the page `<h1>` and the card
heading an `<h2>` — the card is already labelled by `aria-labelledby`,
so nothing else changes.

### F2. Half-implemented ARIA tabs
`auth-form.tsx:23-42` uses `role="tablist"`/`role="tab"`/`aria-selected`
but there is no `role="tabpanel"`, no `aria-controls`/`id` linkage, and
no arrow-key navigation — screen readers announce "tab 1 of 2" and then
the promised pattern doesn't work.

**Suggestion:** either complete the pattern (tabpanel wrapper +
Left/Right key handling + roving tabindex), or — simpler and equally
accessible — drop the tab roles and render two plain toggle buttons with
`aria-pressed`. Half-ARIA is worse than none.

### F3. No pending state on submit
`auth-form.tsx:93-95` — the submit button stays enabled and unchanged
while the server action runs. On the college Wi-Fi this invites double
submissions and gives zero feedback.

**Suggestion:** a tiny `SubmitButton` using `useFormStatus()`:
disabled + "Logging in…" / "Creating account…" while pending. Reuse it
for every form in the app (same gap exists on all manager forms).

### F4. No password recovery path
There is no "Forgot password?" link and no reset flow. For a
college-wide audience this is a guaranteed support burden — locked-out
students have no self-service exit.

**Suggestion:** add the Supabase `resetPasswordForEmail` flow and link it
from the login card.

## 🟡 Low

### F5. Email input allows spellcheck/autocapitalize
`auth-form.tsx:72-79` — add `spellCheck={false}` (and
`autoCapitalize="none"` for iOS) on the email input per the
"disable spellcheck on emails" guideline.

### F6. Password requirements invisible until failure
`minLength={8}` exists but nothing tells the user before the browser
validation bubble. Add a `<small>` hint ("At least 8 characters") under
the signup password field, and consider a show-password toggle
(`aria-pressed` icon button with `aria-label`).

### F7. Mode switch discards typed input silently
Toggling Log in ↔ Sign up unmounts the name field and keeps shared
fields, which is fine — but an error notice from the previous submit
(query param) stays visible above the other mode's form and can mislead
("Invalid credentials" shown over the signup form).

**Suggestion:** clear `error`/`message` display on mode change (track
dismissed state), or tag the notice with the mode it came from.

### F8. Inactive tab has no hover state
`.auth-tab` (`globals.css:129-137`) defines no `:hover`, so the
clickable inactive tab gives no pointer feedback. Add a subtle
`:hover { color: #173c27; }`.

## ✓ Verified live

- `/` and `/store-manager/products` correctly redirect unauthenticated
  visitors to `/auth` (desktop + mobile).
- Focus ring clearly visible on inputs and buttons
  (`screenshots/auth-focus-desktop.png`).
- No horizontal overflow at 390 px or 1440 px.
- `viewport` meta is sane (`width=device-width, initial-scale=1` — no
  `user-scalable=no`).
