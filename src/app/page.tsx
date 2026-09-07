import Link from "next/link";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-12 px-6 py-16">
      <header className="rise flex flex-col gap-4">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-oxblood">Alcohol Verification App</p>
        <h1 className="font-display text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl">
          Check a label against its application in one glance.
        </h1>
        <p className="max-w-2xl text-xl leading-relaxed text-ink-soft">
          Upload a photo of the label and the details from the application. Each of the seven TTB fields gets a
          Pass, Needs review, or Fail with a plain-English reason. You make the final call.
        </p>
      </header>

      <nav aria-label="Review modes" className="rise grid gap-5 sm:grid-cols-2" style={{ animationDelay: "120ms" }}>
        <Link
          href="/single"
          className="group flex flex-col gap-2 rounded-2xl border-2 border-rule bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-oxblood"
        >
          <span className="text-2xl font-display font-semibold">
            <span aria-hidden="true">🏷️ </span>Review one label
          </span>
          <span className="text-ink-soft">Upload a label, enter the application, get a verdict.</span>
          <span className="mt-2 font-bold text-oxblood group-hover:underline">Start a review →</span>
        </Link>
        <Link
          href="/batch"
          className="group flex flex-col gap-2 rounded-2xl border-2 border-rule bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-oxblood"
        >
          <span className="text-2xl font-display font-semibold">
            <span aria-hidden="true">📦 </span>Review a batch
          </span>
          <span className="text-ink-soft">Hundreds of labels at once, from a spreadsheet and a folder of photos.</span>
          <span className="mt-2 font-bold text-oxblood group-hover:underline">Start a batch →</span>
        </Link>
      </nav>

      <p className="text-sm text-ink-faint">A prototype for TTB label review. Nothing you upload is stored.</p>
    </main>
  );
}
