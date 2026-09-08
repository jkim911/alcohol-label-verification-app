import Link from "next/link";
import { Layers, Tag } from "lucide-react";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Alcohol Verification App</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Check a label against its application in one glance.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
          Upload a photo of the label and the details from the application. Each of the seven TTB fields gets a
          Pass, Needs review, or Fail with a plain-English reason. You make the final call.
        </p>
      </header>

      <nav aria-label="Review modes" className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/single"
          className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-6 shadow-card transition hover:border-accent"
        >
          <span className="flex items-center gap-2 text-lg font-semibold">
            <Tag size={20} aria-hidden="true" className="text-accent" />Review one label
          </span>
          <span className="text-ink-soft">Upload a label, enter the application, get a verdict.</span>
          <span className="mt-2 font-bold text-accent group-hover:underline">Start a review →</span>
        </Link>
        <Link
          href="/batch"
          className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-6 shadow-card transition hover:border-accent"
        >
          <span className="flex items-center gap-2 text-lg font-semibold">
            <Layers size={20} aria-hidden="true" className="text-accent" />Review a batch
          </span>
          <span className="text-ink-soft">Hundreds of labels at once, from a spreadsheet and a folder of photos.</span>
          <span className="mt-2 font-bold text-accent group-hover:underline">Start a batch →</span>
        </Link>
      </nav>

      <p className="text-sm text-ink-faint">A prototype for TTB label review. Nothing you upload is stored.</p>
    </main>
  );
}
