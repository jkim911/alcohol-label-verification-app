import { Check, Minus, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { FieldStatus } from "@/lib/types";

/** Colour + icon + word, so no state depends on colour alone. */
export const STATUS_LABEL: Record<FieldStatus, string> = {
  pass: "Pass",
  review: "Needs review",
  fail: "Fail",
};

const STYLES: Record<FieldStatus | "na", { Icon: LucideIcon; ring: string; text: string; soft: string }> = {
  pass: { Icon: Check, ring: "bg-pass text-surface", text: "text-pass", soft: "bg-pass-soft" },
  review: { Icon: TriangleAlert, ring: "bg-review text-surface", text: "text-review", soft: "bg-review-soft" },
  fail: { Icon: X, ring: "bg-fail text-surface", text: "text-fail", soft: "bg-fail-soft" },
  na: { Icon: Minus, ring: "bg-border-strong text-surface", text: "text-ink-faint", soft: "bg-surface-muted" },
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
  const dim = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const px = size === "lg" ? 26 : 18;
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full ${dim} ${s.ring}`}>
      <s.Icon size={px} strokeWidth={2.5} />
    </span>
  );
}
