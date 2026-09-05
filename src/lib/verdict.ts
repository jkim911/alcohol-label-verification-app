/**
 * Roll the seven field results up into one recommendation.
 */
import { MATCHERS } from "@/lib/matchers";
import { LABEL_FIELDS, type Application, type FieldResult, type FieldStatus, type LabelExtraction, type ReviewVerdict } from "@/lib/types";

const SEVERITY: Record<FieldStatus, number> = { pass: 0, review: 1, fail: 2 };

/** Worst status among applicable fields; N/A fields never drag the verdict down. */
export function overallStatus(fields: FieldResult[]): FieldStatus {
  let worst: FieldStatus = "pass";
  for (const f of fields) {
    if (f.notApplicable) continue;
    if (SEVERITY[f.status] > SEVERITY[worst]) worst = f.status;
  }
  return worst;
}

export function matchAll(application: Application, extraction: LabelExtraction): FieldResult[] {
  return LABEL_FIELDS.map((field) => MATCHERS[field](application, extraction));
}

export function buildVerdict(application: Application, extraction: LabelExtraction, durationMs: number): ReviewVerdict {
  const fields = matchAll(application, extraction);
  return { applicationId: application.id, overall: overallStatus(fields), fields, extraction, durationMs };
}

/** Below this the label is treated as unreadable and no verdict is offered. */
export const MIN_CONFIDENCE = 0.5;

export function isUnreadable(extraction: LabelExtraction): string | null {
  if (extraction.unreadableReason) return extraction.unreadableReason;
  if (extraction.confidence < MIN_CONFIDENCE) {
    return "The label reader wasn't confident enough in what it read.";
  }
  return null;
}
