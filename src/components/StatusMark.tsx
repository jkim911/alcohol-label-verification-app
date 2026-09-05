import type { FieldStatus } from "@/lib/types";

/** Colour + shape + word, so no state depends on colour alone. */
export const STATUS_LABEL: Record<FieldStatus, string> = {
  pass: "Pass",
  review: "Needs review",
  fail: "Fail",
};

const STYLES: Record<FieldStatus | "na", { glyph: string; ring: string; text: string; soft: string }> = {
  pass: { glyph: "✓", ring: "bg-pass text-card", text: "text-pass", soft: "bg-pass-soft" },
  review: { glyph: "!", ring: "bg-review text-card", text: "text-review", soft: "bg-review-soft" },
  fail: { glyph: "✗", ring: "bg-fail text-card", text: "text-fail", soft: "bg-fail-soft" },
  na: { glyph: "–", ring: "bg-rule-strong text-card", text: "text-ink-faint", soft: "bg-paper-deep" },
};

export function statusStyles(status: FieldStatus, notApplicable?: boolean) {
  return STYLES[notApplicable ? "na" : status];
}

export function StatusMark({
  status,
  notApplicable,
  size = "md",
}: {
  status: FieldStatus;
  notApplicable?: boolean;
  size?: "md" | "lg";
}) {
  const s = statusStyles(status, notApplicable);
  const dim = size === "lg" ? "h-14 w-14 text-3xl" : "h-9 w-9 text-lg";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black ${dim} ${s.ring}`}
    >
      {s.glyph}
    </span>
  );
}
