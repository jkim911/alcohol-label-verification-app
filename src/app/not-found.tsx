import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-oxblood">Page not found</p>
      <h1 className="font-display text-4xl font-semibold">There&apos;s nothing at this address.</h1>
      <p className="text-ink-soft">The app has two places to go: review one label, or review a batch.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/single" className="btn-primary">Review one label</Link>
        <Link href="/batch" className="btn-secondary">Review a batch</Link>
      </div>
    </main>
  );
}
