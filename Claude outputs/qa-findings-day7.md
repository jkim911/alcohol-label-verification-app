# QA findings — final review before submission

Independent review of the finished app: read every source file, reinstalled
dependencies from scratch and ran the real test suite/lint/build, and drove
the live deployed site (single review + full 14-fixture batch) with real
Claude API calls. One confirmed bug, two small things worth considering,
one latency observation. Everything else held up.

## Fix this: "Try a different photo" doesn't reopen the file picker

**File:** `src/components/ReviewSingle.tsx`, the `unreadable` phase's button:

```tsx
<button type="button" className="btn-primary" onClick={() => { setFile(null); setPhase({ kind: "input" }); fileInput.current?.click(); }}>
  <span aria-hidden="true">📷 </span>Try a different photo
</button>
```

**Root cause:** the hidden `<input ref={fileInput} type="file" .../>` only
exists in the DOM while `phase.kind` is `"input"`, `"reviewing"`, or
`"error"` — it's unmounted while `phase.kind === "unreadable"`. So at the
moment this onClick fires, `fileInput.current` is `null`. `setPhase({kind:
"input"})` doesn't remount the input until the next render, by which point
the `.click()` call has already been a no-op. Nothing throws (the `?.`
swallows it), so it fails silently.

**Observed behavior (reproduced on the live site):** clicking the button
correctly clears the old photo and returns to the empty upload form, but no
file dialog opens. The user has to click "Choose a photo" a second time.
Not a dead end, just a broken one-click affordance.

**Suggested fix:** defer the `.click()` until after the input has
remounted — e.g. a `useEffect` that fires the click once when phase becomes
`"input"` and a flag says "and open the picker", or `requestAnimationFrame(() =>
fileInput.current?.click())` inside the handler. Worth a quick check that
`BatchReview.tsx`'s `csvInput`/`imgInput` refs don't have the same issue —
they don't (their buttons and inputs are both always mounted together in
the `setup` phase), but confirm nothing on the batch screen was copied from
this pattern.

## Worth considering: duplicate CSV `id`s are silently dropped

**File:** `src/lib/batch.ts`, `pairImages()`:

```ts
const byId = new Map<string, F>();
...
for (const id of ids) {
  const stem = id.trim().toLowerCase();
  const f = byStem.get(stem);
  if (f) {
    byId.set(id, f);
    ...
```

If a batch CSV has two rows with the same `id`, `byId.set` just overwrites
the first — one label vanishes from the run with no error surfaced
anywhere. The screen already reports "rows with no photo" and "photos with
no row" up front; a "duplicate ids" check in the same pairing summary would
close this gap cheaply.

## Worth considering: no way to cancel a running batch

Once "Review N labels" is clicked there's no abort/cancel control while
`phase.kind === "running"` — only closing the tab stops it. Minor, but
worth a thought given batch mode's whole reason for existing is Sarah's
200–300-label dumps; a wrong CSV or photo folder currently has to run to
completion.

## Observed, not a bug: two live calls exceeded the 5-second budget

Running the full 14-fixture "try a sample batch" against the live site
(six at a time, real API calls) came back in 13 s with the exact expected
5 fail / 3 review / 1 unreadable / 5 pass split — but two of the fourteen
individual `/api/review` calls took 6.2 s and 7.7 s, over the interviews'
stated "results back in about 5 seconds" bar. Nothing errored or timed out;
this is just real-world latency variance (network/model load), not a code
defect. Worth knowing about rather than treating the 5-second number as
fully locked down — if there's time, worth a couple more live batch runs to
see how often outliers like this happen.

## Everything independently verified as working

- Fresh `npm install` + `npm test`: **71/71 tests pass** (8 test files).
- `npm run lint`: clean.
- `npm run build`: compiles with no type errors across all 9 routes.
- Live site, single flow: the "blurry-unreadable" sample correctly returns
  an unreadable result ("heavily blurred... illegible") with no verdict,
  not a guess.
- Live site, batch flow: full 14-fixture run matches
  `fixtures/FIXTURE_MANIFEST.json` exactly, including every per-field
  reason string (dropped "Straight" qualifier, reordered class/type words,
  title-case warning heading rejected, reworded warning caught, city
  mismatch, missing country of origin).
- Server-side upload validation (file type, 10 MB size cap) is independent
  of the client-side resize, so a bypassed or failed resize can't get past
  the API route.
- The Day 6 country-normalization fix ("Product of Italy" → "Italy") is in
  place and covered by a test.
