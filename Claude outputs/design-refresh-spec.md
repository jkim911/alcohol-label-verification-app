# Design refresh: from "AI-generated" to compliance-SaaS

Direction: **clean compliance SaaS** — think Vanta, Drata, Linear. Neutral
slate/white base, one restrained accent color, sans-serif throughout, sharp
minimal corners, real icons, denser and quieter than a marketing page.

## Why it currently reads as AI-generated

Naming the tells so it's clear what to remove, not just what to add:

1. **Fraunces** — an ornate, variable-optical-size literary serif — used for
   every heading. Distinctive display serifs on headings are one of the
   most recognizable "generated landing page" signals.
2. **Warm boutique palette** — cream paper (`#f4efe4`), oxblood/wine accent
   (`#7a1f2b`), two soft radial-gradient washes behind the whole page.
   Editorial and cozy, not a tool an ops team lives in for 8 hours.
3. **Emoji as icons** — 🥃🍷🍺🏷️📁🖼️🧪▶⬇↻✎🖨■⇄📷 used throughout instead of a
   real icon set. Emoji icons render inconsistently across OSes and read
   as a placeholder, not a finished product.
4. **Pill buttons everywhere** — `border-radius: 999px` on every button,
   2px-thick borders, oversized 52px+ touch targets, a hover
   `translateY(-1px)` bounce. Friendly/marketing, not utilitarian.
5. **Heavy floaty shadows** (`0 12px 32px -12px`) and thick decorative
   borders (2-4px) on every card.
6. **Marketing-scale type** — the homepage headline is
   `text-[2.6rem] sm:text-6xl`; that's a landing-page hero, not a page
   title in an internal tool.
7. **Bouncy entrance motion** — every panel fades in with a 450ms
   `translateY(10px)` "rise," plus a sliding-highlight "sweep" loading bar.
   Real dashboards are quieter.

None of the underlying accessibility work needs to change (focus
management, `aria-live`, color+shape+word status, skip link, contrast
ratios) — this is a visual-language pass only.

## Typography

Drop Fraunces entirely. Keep **Public Sans** (already loaded, already a
clean, well-made grotesk — it's literally the U.S. government's own
USWDS typeface, which is a nice coincidence for a TTB tool) as the only
typeface, for both headings and body. This is a one-line change:

`src/app/layout.tsx`
```diff
- import { Fraunces, Public_Sans } from "next/font/google";
+ import { Public_Sans } from "next/font/google";
-
- const fraunces = Fraunces({
-   variable: "--font-fraunces",
-   subsets: ["latin"],
-   axes: ["opsz", "SOFT"],
- });

  const publicSans = Public_Sans({
    variable: "--font-public-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
  });
```
```diff
- <html lang="en" className={`${fraunces.variable} ${publicSans.variable} h-full antialiased`}>
+ <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
```

`globals.css` — retire the separate display token so `font-display`
utilities fall back to the same sans (or just find/replace `font-display`
usages to remove them):
```diff
- --font-display: var(--font-fraunces), "Iowan Old Style", Georgia, serif;
  --font-sans: var(--font-public-sans), "Helvetica Neue", Arial, sans-serif;
```

Scale down the marketing-sized headings. Specifically:
- Homepage `<h1>`: `text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl`
  → `text-3xl font-semibold sm:text-4xl` (a page title, not a hero).
- Section `<h1>`s on `/single` and `/batch`: `text-4xl ... sm:text-5xl` →
  `text-2xl sm:text-3xl`.
- Section `<h2>`s: keep `text-2xl font-semibold` (already restrained).
- Uppercase eyebrow labels (`text-sm font-bold uppercase tracking-[0.2em]`):
  reduce to `tracking-wide` (0.2em reads like a perfume ad; 0.05–0.08em is
  the normal SaaS convention for this pattern).

## Color tokens

Replace the `@theme` block in `globals.css` wholesale:

```css
@theme {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-muted: #f1f5f9;
  --color-ink: #0f172a;
  --color-ink-soft: #475569;
  --color-ink-faint: #64748b; /* ~4.6:1 on white — keep the same contrast bar */
  --color-border: #e2e8f0;
  --color-border-strong: #cbd5e1;
  --color-accent: #2563eb;
  --color-accent-deep: #1d4ed8;
  --color-accent-soft: #eff6ff;
  --color-pass: #15803d;
  --color-pass-soft: #f0fdf4;
  --color-review: #b45309;
  --color-review-soft: #fffbeb;
  --color-fail: #dc2626;
  --color-fail-soft: #fef2f2;
  --font-sans: var(--font-public-sans), "Helvetica Neue", Arial, sans-serif;
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.08);
}
```

Then rename every usage across the codebase (`grep -rl` for each):
`paper`→`bg`, `paper-deep`→`surface-muted`, `card`→`surface`, `rule`→`border`,
`rule-strong`→`border-strong`, `oxblood`/`oxblood-deep`→`accent`/`accent-deep`,
`oxblood-soft`→`accent-soft`. Recheck contrast on the two changed status
colors (`review` and `fail` shifted slightly) against their `-soft`
backgrounds — same 4.5:1 bar the app already holds itself to.

`body`'s background: drop both radial gradients, use a flat
`background-color: var(--color-bg)`.

## Shape, borders, shadows

- Buttons (`.btn-primary`, `.btn-secondary`): `border-radius: 999px` →
  `0.5rem`. Border `2px` → `1px`. Drop the `translateY(-1px)` hover; a
  background-color change alone is enough feedback. Reduce min-height from
  `3.25rem` to `2.5rem` (52px buttons are touch-target-for-a-kiosk sized,
  not needed at this scale — 40px still clears WCAG's 24px minimum
  comfortably).
- `.field-input`: `border-radius: 0.75rem` → `0.5rem`, border `2px` →
  `1px`, min-height `3.25rem` → `2.75rem`.
- Cards/panels (the `rounded-2xl border-2 ... shadow-card` pattern
  repeated across every section): `rounded-2xl` → `rounded-lg`, `border-2`
  → `border`, keep `shadow-card` but it's now the much subtler value above.
- Dashed drop-zones (`border-4 border-dashed`): `border-4` → `border-2`,
  same dashed style is fine — dashed drop-zones are a real, common pattern
  (GitHub, Linear attachments), just don't need to be that thick.
- Filter chips in `BatchReview.tsx` (`rounded-full`) — these can **stay**
  pill-shaped. Small filter/status chips are a genuine, common enterprise
  pattern (Linear, GitHub labels); it's *buttons* and *cards* being pills
  that reads as templated. Just tighten the padding a little.

## Motion

- `.rise` (`translateY(10px)` + opacity, 450ms `cubic-bezier` bounce):
  replace with a plain opacity fade, no transform, 150ms `ease-out`. Keep
  it only where it's load-bearing for the accessibility behavior (the
  verdict banner appearing) — fine to drop it entirely from decorative
  staggered card entrances (the `animationDelay` stagger on field rows).
- `.sweep` (sliding-highlight indeterminate bar): keep the *mechanic*
  (still useful while waiting on the extraction call) but restyle it —
  thinner (2px), `var(--color-accent)`, a plain linear sweep with no
  easing flourish. This exact pattern (thin animated indeterminate bar)
  is standard in real products (GitHub Actions, Vercel deploys), so it
  doesn't need to disappear, just look less like a loading screen from a
  game.

## Icons: replace every emoji with a real icon set

Add `lucide-react` (MIT, tree-shakeable, this is what Linear/Vanta-style
products actually use). `npm install lucide-react`.

Every current emoji, with its replacement:

| Where | Emoji | Replace with |
|---|---|---|
| Spirits product type | 🥃 | `GlassWater` |
| Wine product type | 🍷 | `Wine` |
| Beer/malt product type | 🍺 | `Beer` |
| Empty photo drop-zone | 🏷️ | `Image` |
| Choose a photo | 📁 | `Upload` |
| Choose CSV | 📄 | `FileText` |
| Choose photos (batch) | 🖼️ | `Images` |
| Try a sample (batch) | 🧪 | `FlaskConical` |
| Review N labels (run) | ▶ | `Play` |
| Export CSV | ⬇ | `Download` |
| Start another / Review another / Try again | ↻ | `RotateCcw` |
| Change details | ✎ | `Pencil` |
| Print or save as PDF | 🖨 | `Printer` |
| Stop after the current labels | ■ | `Square` |
| Compare label to application | ⇄ | `ScanSearch` |
| Try a different photo | 📷 | `Camera` |

And in `StatusMark.tsx`, swap the unicode glyphs (`✓`, `!`, `✗`, `–`) for
real icons rendered inside the same colored circle — `Check`, `AlertTriangle`,
`X`, `Minus` at a fixed pixel size (e.g. `size={18}` in the `md` variant,
`size={28}` in `lg`). This is a bigger legibility win than it sounds: at
36px the current unicode glyphs render with inconsistent optical weight
between the checkmark and the X; matched-weight line icons fix that for
free.

Every icon-plus-word button pattern in the app already keeps the icon
`aria-hidden="true"` next to a real text label — that accessibility pattern
is correct as-is and doesn't need to change, just swap what's inside the
`<span aria-hidden>`.

## What NOT to change

- The three-state pass/review/fail model, the tolerance rules, the
  matching engine, the extraction pipeline — none of this is touched.
- Accessibility behavior: focus management, `aria-live` regions, skip
  link, color+shape+word status redundancy, 44px minimum touch targets
  (just not 52px+ everywhere), contrast ratios.
- The print stylesheet's logic, just its visual values follow the same
  token renames above.
- Copy/wording — the plain-English tone ("Nothing is approved or rejected
  until you decide") is a real strength independent of visual style.

## Suggested order of work

1. Font + type-scale changes (layout.tsx, globals.css, the handful of
   oversized headings) — mechanical, low risk.
2. `@theme` token replacement + find/replace of old color names across
   components — mechanical, but touches every file, so do it as one pass
   and re-run the full test suite + a visual pass after.
3. Radius/border/shadow/motion values in `globals.css`.
4. Icon swap — install `lucide-react`, replace each emoji per the table
   above, restyle `StatusMark`.
5. Re-run `npm test`, `npm run lint`, `npm run build`, then a manual pass
   over `/`, `/single`, and `/batch` (including the print view) at both
   375px and 1280px, matching the Day 5 responsive check.
