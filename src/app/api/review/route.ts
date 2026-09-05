/**
 * POST /api/review — label image + application data → ReviewVerdict.
 *
 * Multipart form: `image` (file) and `application` (JSON string).
 * Responses:
 *   200 { status: "ok", verdict }
 *   200 { status: "unreadable", reason, extraction, durationMs }
 *   4xx/5xx { error }  — plain English, safe to show as-is
 */
import { parseApplication } from "@/lib/application-schema";
import { ExtractionError, extractLabel, isSupportedImageType } from "@/lib/extract";
import { buildVerdict, isUnreadable } from "@/lib/verdict";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const started = performance.now();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the label image and application details as a form." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a label image to upload." }, { status: 400 });
  }
  if (!isSupportedImageType(file.type)) {
    return Response.json({ error: "That file type isn't supported. Upload a JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That image is over 10 MB. Try a smaller photo." }, { status: 400 });
  }

  const rawApp = form.get("application");
  if (typeof rawApp !== "string") {
    return Response.json({ error: "Fill in the application details." }, { status: 400 });
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawApp);
  } catch {
    return Response.json({ error: "The application details couldn't be read. Please try again." }, { status: 400 });
  }
  const parsed = parseApplication(parsedJson);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { extraction } = await extractLabel(bytes, file.type);
    const durationMs = Math.round(performance.now() - started);

    const unreadable = isUnreadable(extraction);
    if (unreadable) {
      return Response.json({ status: "unreadable", reason: unreadable, extraction, durationMs });
    }
    const verdict = buildVerdict(parsed.application, extraction, durationMs);
    return Response.json({ status: "ok", verdict });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("review: unexpected error", error);
    return Response.json({ error: "Something went wrong while reviewing the label. Please try again." }, { status: 500 });
  }
}
