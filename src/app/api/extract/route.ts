/**
 * POST /api/extract — multipart form with an `image` file → LabelExtraction.
 *
 * Runs on the Node runtime (not edge) so the Anthropic SDK and Buffer work.
 * Every failure returns JSON `{ error }` with a plain-English message the UI
 * can show as-is; never a stack trace.
 */
import { ExtractionError, extractLabel, isSupportedImageType } from "@/lib/extract";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the label as a form upload named 'image'." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a label image to upload." }, { status: 400 });
  }
  if (!isSupportedImageType(file.type)) {
    return Response.json(
      { error: "That file type isn't supported. Upload a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That image is over 10 MB. Try a smaller photo." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await extractLabel(bytes, file.type);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ExtractionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("extract: unexpected error", error);
    return Response.json(
      { error: "Something went wrong while reading the label. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json(
    { error: "Use POST with a multipart form containing an 'image' file." },
    { status: 405 },
  );
}
