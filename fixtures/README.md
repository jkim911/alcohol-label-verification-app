# Fixtures

Sample label images paired with the application data an applicant would have
submitted, so reviewers can test without sourcing their own images.

```
fixtures/
  applications/<id>.json   # Application (see src/lib/types.ts)
  labels/<id>.png          # the label image with the same id
  FIXTURE_MANIFEST.json    # id, product, expected outcome — for scripts
  generate_fixtures.py     # renders every image and JSON from one table
```

## Why synthetic renders, not AI-generated art

`generate_fixtures.py` draws each label with Pillow from the same data that
writes the application JSON, so the printed text is byte-exact and image and
JSON can't drift apart. That precision matters: several fixtures exist to
test exact-match logic (the government warning), where a generative image
model's unreliable text rendering would silently invalidate the test.

```bash
python3 fixtures/generate_fixtures.py                    # regenerate everything
python3 fixtures/generate_fixtures.py stones-throw-ok    # just these ids
npm run samples:sync                                     # copy to public/samples + write the batch CSVs
npm run extract:fixtures                                 # read every label with Claude, print latency
```

Run `npm run samples:sync` after any change here so the UI's "Try a sample"
list (`src/lib/samples.ts`, `public/samples/`, `public/batch-template.csv`)
stays in step.

## The set (14 fixtures)

| id                       | product | scenario                                                        | expected   |
| ------------------------ | ------- | --------------------------------------------------------------- | ---------- |
| `stones-throw-ok`        | spirits | brand casing differs only ("STONE'S THROW" vs "Stone's Throw")  | pass       |
| `abv-off-by-1`           | spirits | label ABV 41.0, application 40.0 (outside ±0.3)                  | fail       |
| `abv-off-by-0.2`         | beer    | label ABV 5.2, application 5.0 (within ±0.3)                     | pass       |
| `warning-reworded`       | wine    | one word added to the government warning                         | fail       |
| `warning-lowercase`      | spirits | "Government Warning:" not in ALL CAPS                             | fail       |
| `address-mismatch`       | beer    | label city/state/ZIP differs from application                     | fail       |
| `import-missing-origin`  | wine    | import, no country of origin printed (importer address is in NJ)  | fail       |
| `class-qualifier-drop`   | spirits | "Straight" dropped from class/type on the label                   | review     |
| `class-type-reorder`     | wine    | class/type word order changed on the label                        | review     |
| `net-contents-unit-diff` | beer    | net contents in different but equal units (750 mL vs 0.75 L)      | pass       |
| `blurry-unreadable`      | spirits | heavy blur + tilt; extraction reports low confidence               | no verdict |
| `address-abbrev-ok`      | spirits | "Mill Creek Road" printed as "Mill Creek Rd." (Day 6, untuned)    | pass       |
| `import-with-origin-ok`  | wine    | import with "Product of Italy" printed (Day 6, untuned)           | pass       |
| `brand-extra-word`       | beer    | label reads "Harbor Light Reserve", application "Harbor Light" (Day 6, untuned) | review |

The last three were added on Day 6 *after* the matchers were written, as
fresh cases the code hadn't been tuned against. One of them found a bug:
the model returned "Product of Italy" for the country field and the matcher
compared it literally against "Italy". Both the prompt and the matcher were
fixed (see `docs/devlog.md`, Day 6).
