export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
          Old Tom Verify
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Check an alcohol label against its application in one glance.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Upload a label photo and the application details. Each of the seven
          TTB fields gets a Pass, Needs review, or Fail with a plain-English
          reason. You make the final call.
        </p>
      </header>

      <nav aria-label="Review modes" className="grid gap-4 sm:grid-cols-2">
        <a
          href="/single"
          aria-disabled="true"
          className="rounded-lg border border-zinc-300 p-5 text-left opacity-60 dark:border-zinc-700"
        >
          <span className="block text-lg font-semibold">🏷️ Review one label</span>
          <span className="block text-zinc-600 dark:text-zinc-400">Coming on Day 3</span>
        </a>
        <a
          href="/batch"
          aria-disabled="true"
          className="rounded-lg border border-zinc-300 p-5 text-left opacity-60 dark:border-zinc-700"
        >
          <span className="block text-lg font-semibold">📦 Review a batch</span>
          <span className="block text-zinc-600 dark:text-zinc-400">Coming on Day 4</span>
        </a>
      </nav>

      <p className="text-sm text-zinc-500">
        Day 1 placeholder. This URL will keep improving all week.
      </p>
    </main>
  );
}
