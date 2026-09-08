"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BATCH_STATUS_LABEL,
  type BatchResult,
  type BatchStatus,
  dedupeApplications,
  pairImages,
  resultsToCsv,
  rowToApplication,
  runPool,
  summarizeVerdict,
} from "@/lib/batch";
import { csvToObjects } from "@/lib/csv";
import { resizeImageForUpload } from "@/lib/image-resize";
import { SAMPLES } from "@/lib/samples";
import type { Application } from "@/lib/types";
import { StatusMark } from "./StatusMark";
import { VerdictView } from "./VerdictView";

/** How many reviews run at once from the browser. Each is one serverless call. */
const CONCURRENCY = 6;

type Phase = { kind: "setup" } | { kind: "running" } | { kind: "done"; stopped: boolean };

type SortKey = "order" | "status" | "brand" | "id" | "time";
const STATUS_ORDER: Record<BatchStatus, number> = { fail: 0, error: 1, unreadable: 2, review: 3, pass: 4 };

export function BatchReview() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [csvName, setCsvName] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [done, setDone] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [filter, setFilter] = useState<BatchStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("order");
  const [selected, setSelected] = useState<BatchResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLButtonElement>(null);

  // Focus follows the work: the results heading when a run finishes, the back button when a row opens.
  useEffect(() => {
    if (phase.kind === "done" && !selected) resultsRef.current?.focus();
  }, [phase.kind, selected]);
  useEffect(() => {
    // previewUrl is set one render after `selected`, and the detail view waits for it.
    if (selected && (previewUrl || !selected.verdict)) detailRef.current?.focus();
  }, [selected, previewUrl]);

  const pairing = useMemo(() => pairImages(applications.map((a) => a.id), images), [applications, images]);
  const ready = applications.length > 0 && pairing.byId.size > 0;

  useEffect(() => {
    if (phase.kind !== "running") return;
    const t = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 200);
    return () => clearInterval(t);
  }, [phase.kind, startedAt]);

  // Preview image for the detail view.
  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    const f = pairing.byId.get(selected.id);
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selected, pairing]);

  const loadCsvText = (text: string, name: string) => {
    const { headers, rows } = csvToObjects(text);
    if (!headers.includes("id") || !headers.includes("brandName")) {
      setBanner("That CSV doesn't have the expected columns. Download the template and start from it.");
      return;
    }
    const parsedRows: Array<{ application: Application; rowNumber: number }> = [];
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const r = rowToApplication(row, i + 2);
      if ("error" in r) errors.push(r.error);
      else parsedRows.push({ application: r.application, rowNumber: i + 2 });
    });
    // Two rows with the same id would otherwise silently overwrite each other.
    const deduped = dedupeApplications(parsedRows);
    setApplications(deduped.applications);
    setRowErrors([...errors, ...deduped.errors]);
    setCsvName(name);
    setBanner(null);
  };

  const onCsvFile = async (file: File | null | undefined) => {
    if (!file) return;
    loadCsvText(await file.text(), file.name);
  };

  const addImages = (list: FileList | File[] | null | undefined) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of incoming) byName.set(f.name, f);
      return [...byName.values()];
    });
    setBanner(null);
  };

  const loadSampleBatch = async () => {
    setLoadingSample(true);
    try {
      const text = await fetch("/samples/batch-sample.csv").then((r) => r.text());
      loadCsvText(text, "batch-sample.csv");
      const { rows } = csvToObjects(text);
      const files = await Promise.all(
        rows.map(async (row) => {
          const blob = await fetch(`/samples/${row.id}.png`).then((r) => r.blob());
          return new File([blob], `${row.id}.png`, { type: "image/png" });
        }),
      );
      setImages(files);
    } finally {
      setLoadingSample(false);
    }
  };

  const run = async () => {
    const work = applications.filter((a) => pairing.byId.has(a.id));
    setResults([]);
    setDone(0);
    setSelected(null);
    setStartedAt(performance.now());
    setElapsed(0);
    setPhase({ kind: "running" });
    const controller = new AbortController();
    abortRef.current = controller;

    const all = await runPool(
      work,
      CONCURRENCY,
      async (application, _i, signal): Promise<BatchResult | null> => {
        const t0 = performance.now();
        try {
          const original = pairing.byId.get(application.id)!;
          const { file } = await resizeImageForUpload(original);
          if (signal?.aborted) return null;
          const body = new FormData();
          body.append("image", file);
          body.append("application", JSON.stringify(application));
          const res = await fetch("/api/review", { method: "POST", body });
          const data = await res.json();
          const durationMs = Math.round(performance.now() - t0);
          if (!res.ok) return { id: application.id, application, status: "error", note: data.error ?? `Server error ${res.status}`, durationMs };
          if (data.status === "unreadable") {
            return { id: application.id, application, status: "unreadable", extraction: data.extraction, note: data.reason, durationMs };
          }
          return { id: application.id, application, status: data.verdict.overall, verdict: data.verdict, note: summarizeVerdict(data.verdict), durationMs };
        } catch {
          return { id: application.id, application, status: "error", note: "Couldn't reach the server for this label.", durationMs: Math.round(performance.now() - t0) };
        }
      },
      (count, _total, result) => {
        if (!result) return;
        setDone(count);
        setResults((prev) => [...prev, result]);
      },
      { signal: controller.signal },
    );
    const finished = all.filter((r): r is BatchResult => !!r);
    setResults(finished);
    setPhase({ kind: "done", stopped: controller.signal.aborted });
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const reset = () => {
    setPhase({ kind: "setup" });
    setResults([]);
    setSelected(null);
    setFilter("all");
    setSort("order");
  };

  const counts = useMemo(() => {
    const c: Record<BatchStatus, number> = { pass: 0, review: 0, fail: 0, unreadable: 0, error: 0 };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);

  const visible = useMemo(() => {
    const list = results.filter((r) => filter === "all" || r.status === filter);
    const sorted = [...list];
    switch (sort) {
      case "status":
        sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        break;
      case "brand":
        sorted.sort((a, b) => a.application.brandName.localeCompare(b.application.brandName));
        break;
      case "id":
        sorted.sort((a, b) => a.id.localeCompare(b.id));
        break;
      case "time":
        sorted.sort((a, b) => b.durationMs - a.durationMs);
        break;
    }
    return sorted;
  }, [results, filter, sort]);

  const exportCsv = () => {
    const blob = new Blob([resultsToCsv(results)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-review-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const total = applications.filter((a) => pairing.byId.has(a.id)).length;

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-oxblood hover:underline">
            ← Alcohol Verification App
          </Link>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Review a batch</h1>
        </div>
        {phase.kind === "setup" && (
          <button type="button" className="btn-secondary" onClick={loadSampleBatch} disabled={loadingSample}>
            <span aria-hidden="true">🧪 </span>
            {loadingSample ? "Loading sample batch…" : `Try a sample batch (${SAMPLES.length} labels)`}
          </button>
        )}
      </header>

      {banner && (
        <div role="alert" className="rise flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-fail bg-fail-soft p-5">
          <p className="text-ink">{banner}</p>
          <button type="button" className="btn-secondary" onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      )}

      {/* ---------------- Detail view ---------------- */}
      {selected && selected.verdict && previewUrl && (
        <section className="flex flex-col gap-4">
          <button ref={detailRef} type="button" className="btn-secondary self-start" onClick={() => setSelected(null)}>
            ← Back to all results
          </button>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-ink-faint">
            {selected.id} · {selected.application.brandName}
          </p>
          <VerdictView
            verdict={selected.verdict}
            imageUrl={previewUrl}
            onRestart={() => setSelected(null)}
            onEdit={() => setSelected(null)}
            context={{ applicationLabel: `${selected.application.brandName} (${selected.id})`, sourceName: pairing.byId.get(selected.id)?.name }}
          />
        </section>
      )}
      {selected && !selected.verdict && (
        <section className="rise flex flex-col gap-4 rounded-2xl border-2 border-review bg-review-soft p-6 shadow-card">
          <button ref={detailRef} type="button" className="btn-secondary self-start" onClick={() => setSelected(null)}>
            ← Back to all results
          </button>
          <h2 className="font-display text-3xl font-semibold">
            {selected.id}: {BATCH_STATUS_LABEL[selected.status]}
          </h2>
          <p className="text-ink">{selected.note}</p>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- object URL from the user's upload
            <img src={previewUrl} alt={`Label for ${selected.id}`} className="max-h-96 w-auto self-start rounded-lg" />
          )}
        </section>
      )}

      {/* ---------------- Setup ---------------- */}
      {!selected && phase.kind === "setup" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="csv-title" className="flex flex-col gap-3">
            <h2 id="csv-title" className="font-display text-2xl font-semibold">1. The applications (spreadsheet)</h2>
            <p className="text-ink-soft">
              One row per label, with an <code className="rounded bg-paper-deep px-1">id</code> column that matches each image&apos;s file name.{" "}
              <a href="/batch-template.csv" download className="font-bold text-oxblood underline">
                Download the CSV template
              </a>
              .
            </p>
            <div className="flex flex-col gap-3 rounded-2xl border-4 border-dashed border-rule-strong bg-card p-5">
              {csvName ? (
                <p className="text-lg">
                  <strong>{csvName}</strong> — {applications.length} application{applications.length === 1 ? "" : "s"} loaded
                  {rowErrors.length ? `, ${rowErrors.length} row${rowErrors.length === 1 ? "" : "s"} skipped` : ""}.
                </p>
              ) : (
                <p className="text-lg font-bold">Choose the CSV file</p>
              )}
              <button type="button" className="btn-secondary self-start" onClick={() => csvInput.current?.click()}>
                <span aria-hidden="true">📄 </span>{csvName ? "Choose a different CSV" : "Choose CSV"}
              </button>
              <input ref={csvInput} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onCsvFile(e.target.files?.[0])} />
              {rowErrors.length > 0 && (
                <details className="text-sm text-ink-soft">
                  <summary className="cursor-pointer font-bold">Why rows were skipped</summary>
                  <ul className="mt-2 list-disc pl-5">
                    {rowErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          <section aria-labelledby="img-title" className="flex flex-col gap-3">
            <h2 id="img-title" className="font-display text-2xl font-semibold">2. The label photos</h2>
            <p className="text-ink-soft">Select all the photos at once. Big phone photos are shrunk in your browser before upload.</p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addImages(e.dataTransfer.files); }}
              className="flex flex-col gap-3 rounded-2xl border-4 border-dashed border-rule-strong bg-card p-5"
            >
              <p className="text-lg">
                {images.length ? <><strong>{images.length}</strong> photo{images.length === 1 ? "" : "s"} chosen</> : <strong>Drop the photos here</strong>}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={() => imgInput.current?.click()}>
                  <span aria-hidden="true">🖼️ </span>{images.length ? "Add more photos" : "Choose photos"}
                </button>
                {images.length > 0 && (
                  <button type="button" className="btn-secondary" onClick={() => setImages([])}>Clear photos</button>
                )}
              </div>
              <input ref={imgInput} type="file" multiple accept="image/*" className="sr-only" onChange={(e) => addImages(e.target.files)} />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border-2 border-rule bg-card p-5 shadow-card lg:col-span-2">
            <h2 className="font-display text-2xl font-semibold">3. Check the pairing, then run</h2>
            {applications.length === 0 || images.length === 0 ? (
              <p className="text-ink-soft">
                Still needed: {[applications.length === 0 && "the CSV", images.length === 0 && "the photos"].filter(Boolean).join(" and ")}.
              </p>
            ) : (
              <ul className={`grid gap-2 ${pairing.duplicateIds.length ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
                <li className="rounded-xl bg-pass-soft p-3"><strong className="text-pass">{pairing.byId.size}</strong> labels ready (row + photo)</li>
                {pairing.duplicateIds.length > 0 && (
                  <li className="rounded-xl bg-review-soft p-3">
                    <strong className="text-review">{pairing.duplicateIds.length}</strong> duplicate ids (first kept)
                    <span className="block text-sm text-ink-soft">{pairing.duplicateIds.slice(0, 5).join(", ")}</span>
                  </li>
                )}
                <li className={`rounded-xl p-3 ${pairing.missingIds.length ? "bg-review-soft" : "bg-paper-deep"}`}>
                  <strong className={pairing.missingIds.length ? "text-review" : ""}>{pairing.missingIds.length}</strong> rows with no photo
                  {pairing.missingIds.length > 0 && <span className="block text-sm text-ink-soft">{pairing.missingIds.slice(0, 5).join(", ")}{pairing.missingIds.length > 5 ? "…" : ""}</span>}
                </li>
                <li className={`rounded-xl p-3 ${pairing.unmatchedFiles.length ? "bg-review-soft" : "bg-paper-deep"}`}>
                  <strong className={pairing.unmatchedFiles.length ? "text-review" : ""}>{pairing.unmatchedFiles.length}</strong> photos with no row
                  {pairing.unmatchedFiles.length > 0 && <span className="block text-sm text-ink-soft">{pairing.unmatchedFiles.slice(0, 5).join(", ")}{pairing.unmatchedFiles.length > 5 ? "…" : ""}</span>}
                </li>
              </ul>
            )}
            <button type="button" className="btn-primary self-start text-lg" disabled={!ready} onClick={run}>
              <span aria-hidden="true">▶ </span>Review {ready ? `${pairing.byId.size} label${pairing.byId.size === 1 ? "" : "s"}` : "the batch"}
            </button>
            <p className="text-sm text-ink-soft">Runs {CONCURRENCY} at a time. Roughly {Math.ceil((Math.max(total, 1) * 4.5) / CONCURRENCY)} seconds for {total || "your"} labels.</p>
          </section>
        </div>
      )}

      {/* ---------------- Progress ---------------- */}
      {!selected && phase.kind === "running" && (
        <section role="status" aria-live="polite" className="rise flex flex-col gap-3 rounded-2xl border-2 border-rule bg-card p-6 shadow-card">
          <p className="font-display text-3xl font-semibold">
            {done} / {total} reviewed
          </p>
          <div className="h-4 overflow-hidden rounded-full bg-paper-deep">
            <div className="h-full rounded-full bg-oxblood transition-[width] duration-300" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-soft">{elapsed.toFixed(0)} s elapsed · results appear below as each label finishes.</p>
            <button type="button" className="btn-secondary" onClick={stop}>
              <span aria-hidden="true">■ </span>Stop after the current labels
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Results ---------------- */}
      {!selected && (phase.kind === "running" || phase.kind === "done") && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 ref={resultsRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
              {phase.kind === "done"
                ? phase.stopped
                  ? `Stopped after ${results.length} of ${total} labels (${elapsed.toFixed(0)} s)`
                  : `Results for ${results.length} labels in ${elapsed.toFixed(0)} s`
                : "Results so far"}
            </h2>
            {phase.kind === "done" && (
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={exportCsv}>
                  <span aria-hidden="true">⬇ </span>Export CSV
                </button>
                <button type="button" className="btn-primary" onClick={reset}>
                  <span aria-hidden="true">↻ </span>Start another batch
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by result">
            {(["all", "fail", "review", "unreadable", "error", "pass"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`min-h-11 rounded-full border-2 px-4 py-2 font-bold ${filter === k ? "border-oxblood bg-oxblood text-card" : "border-rule-strong bg-card"}`}
              >
                {k === "all" ? `All (${results.length})` : `${BATCH_STATUS_LABEL[k]} (${counts[k]})`}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm font-bold">
              Sort by
              <select className="field-input min-h-11 py-1" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="order">Finished order</option>
                <option value="status">Worst first</option>
                <option value="brand">Brand name</option>
                <option value="id">ID</option>
                <option value="time">Slowest first</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border-2 border-rule bg-card shadow-card">
            <table className="w-full text-left">
              <thead className="bg-paper-deep text-sm uppercase tracking-wider text-ink-soft">
                <tr>
                  <th scope="col" className="px-4 py-3">Result</th>
                  <th scope="col" className="px-4 py-3">Brand</th>
                  <th scope="col" className="px-4 py-3">ID</th>
                  <th scope="col" className="px-4 py-3">What to look at</th>
                  <th scope="col" className="px-4 py-3 text-right">Time</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-rule hover:bg-paper" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-bold">
                        {r.status === "pass" || r.status === "review" || r.status === "fail" ? (
                          <StatusMark status={r.status} />
                        ) : (
                          <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rule-strong text-lg font-black text-card">?</span>
                        )}
                        {BATCH_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.application.brandName}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.id}</td>
                    <td className="max-w-md px-4 py-3 text-ink-soft">{r.note}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">{(r.durationMs / 1000).toFixed(1)} s</td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="min-h-11 rounded-full border-2 border-rule-strong px-3 font-bold text-oxblood hover:border-oxblood"
                        onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                        aria-label={`Open details for ${r.application.brandName} (${r.id})`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">Nothing here yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-soft">Open any row for the full field-by-field view. These are recommendations; nothing is approved or rejected until you decide.</p>
        </section>
      )}
    </main>
  );
}
