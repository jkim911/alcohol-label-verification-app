"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeResize, resizeImageForUpload } from "@/lib/image-resize";
import type { Sample } from "@/lib/samples";
import type { LabelExtraction, ProductType, ReviewVerdict } from "@/lib/types";
import { VerdictView } from "./VerdictView";

type FormState = {
  productType: ProductType;
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerNameAddress: string;
  isImport: boolean;
  countryOfOrigin: string;
};

const EMPTY: FormState = {
  productType: "spirits",
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerNameAddress: "",
  isImport: false,
  countryOfOrigin: "",
};

type Phase =
  | { kind: "input" }
  | { kind: "reviewing" }
  | { kind: "verdict"; verdict: ReviewVerdict }
  | { kind: "unreadable"; reason: string; extraction: LabelExtraction }
  | { kind: "error"; message: string };

const PRODUCT_TYPES: Array<{ value: ProductType; label: string; icon: string }> = [
  { value: "spirits", label: "Spirits", icon: "🥃" },
  { value: "wine", label: "Wine", icon: "🍷" },
  { value: "beer", label: "Beer / malt", icon: "🍺" },
];

export function ReviewSingle({ samples }: { samples: Sample[] }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [sampleId, setSampleId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resizeNote, setResizeNote] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // "Try a different photo" lives on the unreadable screen, where the file input
  // isn't mounted. Set this flag, switch phases, and open the picker once it exists.
  const openPickerOnInput = useRef(false);

  useEffect(() => {
    if (phase.kind === "input" && openPickerOnInput.current) {
      openPickerOnInput.current = false;
      fileInput.current?.click();
    }
  }, [phase.kind]);

  // Move keyboard/screen-reader focus to the outcome once it exists.
  useEffect(() => {
    if (phase.kind === "verdict" || phase.kind === "unreadable" || phase.kind === "error") {
      resultRef.current?.focus();
    }
  }, [phase.kind]);

  // Keep an object URL for the preview and revoke it when the file changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A visible clock while reviewing: silence is what killed the last tool's trust.
  useEffect(() => {
    if (phase.kind !== "reviewing") return;
    const start = performance.now();
    const t = setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
    return () => clearInterval(t);
  }, [phase.kind]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const acceptFile = useCallback(async (candidate: File | null | undefined) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/")) {
      setPhase({ kind: "error", message: "That file isn't an image. Upload a JPEG, PNG, or WebP photo of the label." });
      return;
    }
    // Shrink big phone photos in the browser before they go anywhere.
    setPreparing(true);
    try {
      const result = await resizeImageForUpload(candidate);
      setFile(result.file);
      setResizeNote(describeResize(result));
    } finally {
      setPreparing(false);
    }
    setPhase({ kind: "input" });
  }, []);

  const loadSample = async (id: string) => {
    setSampleId(id);
    const sample = samples.find((s) => s.id === id);
    if (!sample) return;
    const a = sample.application;
    setForm({
      productType: a.productType,
      brandName: a.brandName,
      classType: a.classType,
      alcoholContent: a.alcoholContent == null ? "" : String(a.alcoholContent),
      netContents: a.netContents,
      bottlerNameAddress: a.bottlerNameAddress,
      isImport: a.isImport,
      countryOfOrigin: a.countryOfOrigin ?? "",
    });
    const blob = await fetch(sample.imageUrl).then((r) => r.blob());
    acceptFile(new File([blob], `${sample.id}.png`, { type: "image/png" }));
  };

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!file) m.push("a label photo");
    if (preparing) m.push("the photo to finish preparing");
    if (!form.brandName.trim()) m.push("brand name");
    if (!form.classType.trim()) m.push("class/type");
    if (!form.netContents.trim()) m.push("net contents");
    if (!form.bottlerNameAddress.trim()) m.push("bottler name & address");
    if (form.isImport && !form.countryOfOrigin.trim()) m.push("country of origin");
    return m;
  }, [file, form, preparing]);

  const canCompare = missing.length === 0 && phase.kind !== "reviewing";

  const compare = async () => {
    if (!file || !canCompare) return;
    setPhase({ kind: "reviewing" });
    setElapsed(0);
    const body = new FormData();
    body.append("image", file);
    body.append(
      "application",
      JSON.stringify({
        id: sampleId || "single",
        productType: form.productType,
        brandName: form.brandName,
        classType: form.classType,
        alcoholContent: form.alcoholContent === "" ? null : form.alcoholContent,
        netContents: form.netContents,
        bottlerNameAddress: form.bottlerNameAddress,
        isImport: form.isImport,
        countryOfOrigin: form.isImport ? form.countryOfOrigin : null,
      }),
    );
    try {
      const res = await fetch("/api/review", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setPhase({ kind: "error", message: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      if (data.status === "unreadable") {
        setPhase({ kind: "unreadable", reason: data.reason, extraction: data.extraction });
        return;
      }
      setPhase({ kind: "verdict", verdict: data.verdict });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setPhase({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  };

  const restart = () => {
    setForm(EMPTY);
    setFile(null);
    setResizeNote(null);
    setSampleId("");
    setPhase({ kind: "input" });
    window.scrollTo({ top: 0 });
  };

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-oxblood hover:underline">
            ← Alcohol Verification App
          </Link>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Review one label</h1>
        </div>
        {phase.kind === "input" && (
          <label className="flex w-full flex-col gap-1 text-sm font-bold sm:w-auto">
            <span>Try a sample</span>
            <select
              className="field-input sm:min-w-72"
              value={sampleId}
              onChange={(e) => loadSample(e.target.value)}
              aria-label="Load a sample application and label"
            >
              <option value="">Choose a sample…</option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {phase.kind === "verdict" && previewUrl && (
        <div ref={resultRef} tabIndex={-1} className="outline-none">
        <VerdictView
          verdict={phase.verdict}
          imageUrl={previewUrl}
          onRestart={restart}
          onEdit={() => setPhase({ kind: "input" })}
          context={{ applicationLabel: form.brandName, sourceName: file?.name ?? "" }}
        />
        </div>
      )}

      {phase.kind === "unreadable" && (
        <section ref={resultRef} tabIndex={-1} aria-labelledby="unreadable-title" className="rise flex flex-col gap-4 rounded-2xl border-2 border-review bg-review-soft p-6 shadow-card outline-none">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-review">No verdict · Photo unreadable</p>
          <h2 id="unreadable-title" className="font-display text-3xl font-semibold">We couldn&apos;t read this label clearly.</h2>
          <p className="text-ink">{phase.reason}</p>
          <p className="text-ink-soft">
            Try a straighter, better-lit photo of just the label, with the text filling the frame. Nothing was
            compared, so nothing has been marked as a mismatch.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFile(null);
                setResizeNote(null);
                openPickerOnInput.current = true;
                setPhase({ kind: "input" });
              }}
            >
              <span aria-hidden="true">📷 </span>Try a different photo
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPhase({ kind: "input" })}>
              Back to the form
            </button>
          </div>
        </section>
      )}

      {phase.kind === "error" && (
        <div ref={resultRef} tabIndex={-1} role="alert" className="rise flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-fail bg-fail-soft p-5 outline-none">
          <p className="text-ink">
            <strong>Couldn&apos;t complete the review.</strong> {phase.message}
          </p>
          <button type="button" className="btn-secondary" onClick={() => setPhase({ kind: "input" })}>
            Dismiss
          </button>
        </div>
      )}

      {(phase.kind === "input" || phase.kind === "reviewing" || phase.kind === "error") && (
        <form
          className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          onSubmit={(e) => {
            e.preventDefault();
            compare();
          }}
        >
          {/* ---- Label photo ---- */}
          <section aria-labelledby="photo-title" className="flex flex-col gap-3">
            <h2 id="photo-title" className="font-display text-2xl font-semibold">
              1. The label photo
            </h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]); }}
              className={`flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border-4 border-dashed p-4 text-center transition ${
                dragging ? "border-oxblood bg-oxblood-soft" : "border-rule-strong bg-card"
              }`}
            >
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the user's upload */}
                  <img src={previewUrl} alt="Preview of the label you chose" className="max-h-[28rem] w-auto rounded-lg shadow-card" />
                  <p className="text-sm text-ink-soft">{file?.name}</p>
                  {resizeNote && <p className="text-xs text-ink-faint">{resizeNote}</p>}
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="text-5xl">🏷️</span>
                  <p className="text-lg font-bold">Drop the label photo here</p>
                  <p className="text-ink-soft">or</p>
                </>
              )}
              <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
                <span aria-hidden="true">📁 </span>
                {previewUrl ? "Choose a different photo" : "Choose a photo"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
            </div>
          </section>

          {/* ---- Application details ---- */}
          <section aria-labelledby="app-title" className="flex flex-col gap-5">
            <h2 id="app-title" className="font-display text-2xl font-semibold">
              2. What the application says
            </h2>

            <fieldset>
              <legend className="field-label">Product type</legend>
              <div className="grid grid-cols-3 gap-2">
                {PRODUCT_TYPES.map((p) => (
                  <label
                    key={p.value}
                    className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-2 font-bold transition ${
                      form.productType === p.value ? "border-oxblood bg-oxblood-soft text-oxblood" : "border-rule-strong bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name="productType"
                      value={p.value}
                      checked={form.productType === p.value}
                      onChange={() => update("productType", p.value)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">{p.icon}</span>
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Brand name" id="brandName" value={form.brandName} onChange={(v) => update("brandName", v)} hint="As written on the application, e.g. STONE'S THROW" />
            <Field label="Class / type" id="classType" value={form.classType} onChange={(v) => update("classType", v)} hint="e.g. Kentucky Straight Bourbon Whiskey" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Alcohol content (% ABV)" id="alcoholContent" value={form.alcoholContent} onChange={(v) => update("alcoholContent", v)} hint="Leave blank if not stated" inputMode="decimal" />
              <Field label="Net contents" id="netContents" value={form.netContents} onChange={(v) => update("netContents", v)} hint="e.g. 750 mL or 12 FL OZ" />
            </div>
            <div>
              <label htmlFor="bottler" className="field-label">Bottler name & address</label>
              <textarea id="bottler" rows={2} className="field-input" aria-describedby="bottler-hint" value={form.bottlerNameAddress} onChange={(e) => update("bottlerNameAddress", e.target.value)} />
              <p id="bottler-hint" className="field-hint">Name, street, city, state ZIP — as on the application.</p>
            </div>

            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-rule-strong bg-card px-4 font-bold">
              <input type="checkbox" className="h-6 w-6 accent-oxblood" checked={form.isImport} onChange={(e) => update("isImport", e.target.checked)} />
              This product is imported
            </label>
            {form.isImport && (
              <Field label="Country of origin" id="countryOfOrigin" value={form.countryOfOrigin} onChange={(v) => update("countryOfOrigin", v)} hint="e.g. France" />
            )}

            {/* ---- Compare ---- */}
            <div className="mt-2 flex flex-col gap-3 rounded-2xl border-2 border-rule bg-card p-5 shadow-card">
              <h2 className="font-display text-2xl font-semibold">3. Compare</h2>
              {phase.kind === "reviewing" ? (
                <div role="status" aria-live="polite" className="flex flex-col gap-3">
                  <p className="text-lg font-bold">Reading the label… {elapsed.toFixed(1)} s</p>
                  <div className="h-3 overflow-hidden rounded-full bg-paper-deep">
                    <div className="sweep h-full w-1/3 rounded-full bg-oxblood" />
                  </div>
                  <p className="text-sm text-ink-soft">Usually takes about four seconds. Nothing is decided until you see the results.</p>
                </div>
              ) : (
                <>
                  <button type="submit" className="btn-primary w-full text-lg" disabled={!canCompare}>
                    <span aria-hidden="true">⇄ </span>Compare label to application
                  </button>
                  <p className="text-sm text-ink-soft" aria-live="polite">
                    {missing.length ? `Still needed: ${missing.join(", ")}.` : "Ready. Takes about four seconds."}
                  </p>
                </>
              )}
            </div>
          </section>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  hint,
  inputMode,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        value={value}
        inputMode={inputMode}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
