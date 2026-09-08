"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-wide text-fail">Something went wrong</p>
      <h1 className="text-2xl font-semibold">This page hit a problem it couldn&apos;t recover from.</h1>
      <p className="text-ink-soft">Nothing you entered was saved or sent anywhere. You can try again, or go back to the start.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />Try again
        </button>
        <Link href="/" className="btn-secondary">Back to the start</Link>
      </div>
    </main>
  );
}
