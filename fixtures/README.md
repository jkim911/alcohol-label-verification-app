# Fixtures

Sample label images paired with the application data an applicant would have
submitted, so reviewers can test without sourcing their own images.

```
fixtures/
  applications/<id>.json   # Application (see src/lib/types.ts)
  labels/<id>.png          # the label image with the same id
```

## The set (10 fixtures, generated Day 1)

Rendered as synthetic label images (`fixtures/generate_fixtures.py`, using
Pillow) rather than an AI image generator, so the printed text is guaranteed
byte-exact — that precision matters here because several fixtures exist
specifically to test exact-match logic (the government warning) where a
generative model's unreliable text rendering would silently invalidate the
test. Regenerate the whole set anytime with:

```bash
python3 fixtures/generate_fixtures.py
```

| id                       | product | scenario                                             | expected |
| ------------------------ | ------- | ----------------------------------------------------- | -------- |
| `stones-throw-ok`        | spirits | brand casing differs only ("STONE'S THROW" vs "Stone's Throw") | pass |
| `abv-off-by-1`           | spirits | label ABV 41.0, application 40.0 (outside ±0.3)        | fail |
| `abv-off-by-0.2`         | beer    | label ABV 5.2, application 5.0 (within ±0.3)           | pass |
| `warning-reworded`       | wine    | one word added to the government warning               | fail |
| `warning-lowercase`      | spirits | "Government Warning:" not in ALL CAPS                   | fail |
| `address-mismatch`       | beer    | label city/state/ZIP differs from application           | fail |
| `import-missing-origin`  | wine    | import, no country of origin printed on the label       | fail |
| `class-qualifier-drop`   | spirits | "Straight" dropped from class/type on the label         | review |
| `class-type-reorder`     | wine    | class/type word order changed on the label              | review |
| `net-contents-unit-diff` | beer    | net contents in different but equal units (750 mL vs 0.75 L) | pass |

`FIXTURE_MANIFEST.json` lists the same set programmatically for anything that
wants to iterate the fixtures (e.g. a script that runs every fixture through
`/api/extract` and checks latency/accuracy against the `expected` column).
