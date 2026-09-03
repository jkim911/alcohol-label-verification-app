# Fixtures

Sample label images paired with the application data an applicant would have
submitted, so reviewers can test without sourcing their own images.

```
fixtures/
  applications/<id>.json   # Application (see src/lib/types.ts)
  labels/<id>.{png,jpg}    # the label image with the same id
```

Target set (Day 1 follow-up): 8–12 AI-generated labels across beer, wine, and
spirits. Include deliberate mismatch scenarios so every status is exercised:

| id (suggested)          | scenario                                          | expected |
| ----------------------- | ------------------------------------------------- | -------- |
| `stones-throw-ok`       | everything matches; brand casing differs only      | pass     |
| `abv-off-by-1`          | label ABV 41.0, application 40.0                   | fail     |
| `abv-off-by-0.2`        | label ABV 40.2, application 40.0                   | pass     |
| `warning-reworded`      | one word changed in the government warning         | fail     |
| `warning-lowercase`     | "Government Warning:" in title case                | fail     |
| `address-mismatch`      | different city on the label                        | fail     |
| `import-missing-origin` | import with no country of origin on the label      | fail     |
| `class-qualifier-drop`  | "Straight" missing from class/type                 | review   |
