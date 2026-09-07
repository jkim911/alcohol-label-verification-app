"use client";

import { LABEL_FIELD_NAMES, type FieldResult, type ReviewVerdict } from "@/lib/types";
import { STATUS_LABEL, StatusMark, statusStyles } from "./StatusMark";

const OVERALL_COPY = {
  pass: { title: "Everything matches", body: "All checked fields agree with the application." },
  review: { title: "Needs your review", body: "Some fields are close but not identical. Read the reasons below and decide." },
  fail: { title: "Doesn't match", body: "At least one field disagrees with the application. The reasons below say which and why." },
} as const;

export function VerdictView({
  verdict,
  imageUrl,
  onRestart,
  onEdit,
  context,
}: {
  verdict: ReviewVerdict;
  imageUrl: string;
  onRestart: () => void;
  onEdit: () => void;
  /** Extra lines for the printed report header. */
  context?: { applicationLabel?: string; sourceName?: string };
}) {
  const printedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  const copy = OVERALL_COPY[verdict.overall];
  const s = statusStyles(verdict.overall);
  const counts = verdict.fields.reduce(
    (acc, f) => {
      if (f.notApplicable) acc.na++;
      else acc[f.status]++;
      return acc;
    },
    { pass: 0, review: 0, fail: 0, na: 0 },
  );

  return (
    <section aria-labelledby="verdict-title" className="flex flex-col gap-8">
      <header className="print-only border-b-2 border-ink pb-3">
        <p className="text-sm font-bold uppercase tracking-[0.2em]">Alcohol Verification App · Label review report</p>
        <p className="text-sm">
          {context?.applicationLabel ? `Application: ${context.applicationLabel} · ` : ""}
          {context?.sourceName ? `Image: ${context.sourceName} · ` : ""}
          Reviewed {printedAt} · Recommendation only — the reviewing agent decides.
        </p>
      </header>
      <div className={`rise flex flex-col gap-4 rounded-2xl border-2 p-6 shadow-card sm:flex-row sm:items-center ${s.soft} border-current ${s.text}`}>
        <StatusMark status={verdict.overall} size="lg" />
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.18em]">Recommendation · {STATUS_LABEL[verdict.overall]}</p>
          <h2 id="verdict-title" className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            {copy.title}
          </h2>
          <p className="text-ink-soft">{copy.body}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center text-ink sm:min-w-56">
          <Count n={counts.pass} label="pass" />
          <Count n={counts.review} label="review" />
          <Count n={counts.fail} label="fail" />
        </dl>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <figure className="rise self-start rounded-2xl border-2 border-rule bg-card p-3 shadow-card" style={{ animationDelay: "80ms" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the user's upload */}
          <img src={imageUrl} alt="The label you uploaded" className="w-full rounded-lg" />
          <figcaption className="mt-2 text-center text-sm text-ink-faint">
            Read in {(verdict.durationMs / 1000).toFixed(1)} s · reader confidence {Math.round(verdict.extraction.confidence * 100)}%
          </figcaption>
        </figure>

        <ol className="flex flex-col gap-3" aria-label="Field by field results">
          {verdict.fields.map((f, i) => (
            <FieldRow key={f.field} result={f} index={i} />
          ))}
        </ol>
      </div>

      <footer className="flex flex-col gap-4 rounded-2xl border-2 border-rule bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-soft">
          <strong className="text-ink">This is a recommendation.</strong> Nothing is approved or rejected until you decide.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} className="btn-secondary">
            <span aria-hidden="true">🖨 </span>Print or save as PDF
          </button>
          <button type="button" onClick={onEdit} className="btn-secondary">
            <span aria-hidden="true">✎ </span>Change details
          </button>
          <button type="button" onClick={onRestart} className="btn-primary">
            <span aria-hidden="true">↻ </span>Review another label
          </button>
        </div>
      </footer>
    </section>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-card/70 px-2 py-2">
      <dt className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="font-display text-2xl font-semibold">{n}</dd>
    </div>
  );
}

function FieldRow({ result, index }: { result: FieldResult; index: number }) {
  const s = statusStyles(result.status, result.notApplicable);
  const word = result.notApplicable ? "Not applicable" : STATUS_LABEL[result.status];
  return (
    <li
      className={`rise flex gap-4 rounded-2xl border-2 border-rule bg-card p-4 shadow-card ${result.notApplicable ? "opacity-80" : ""}`}
      style={{ animationDelay: `${120 + index * 60}ms` }}
    >
      <StatusMark status={result.status} notApplicable={result.notApplicable} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 className="font-display text-xl font-semibold">{LABEL_FIELD_NAMES[result.field]}</h3>
          <span className={`text-sm font-bold uppercase tracking-wider ${s.text}`}>{word}</span>
        </div>
        <p className="text-ink">{result.reason}</p>
        {result.field !== "governmentWarning" && (
          <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-2">
            <div>
              <dt className="inline font-bold">On label: </dt>
              <dd className="inline">{result.actual ?? "nothing found"}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Application: </dt>
              <dd className="inline">{result.expected ?? "not stated"}</dd>
            </div>
          </dl>
        )}
      </div>
    </li>
  );
}
