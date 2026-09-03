/**
 * POST /api/extract — reads a label image into a LabelExtraction.
 * Implemented on Day 2 (see src/lib/extract/README.md). Until then the route
 * exists so the deployed URL has an API surface and the shape is fixed.
 */
export async function POST() {
  return Response.json(
    { error: "Label extraction is not implemented yet." },
    { status: 501 },
  );
}

export async function GET() {
  return Response.json(
    { error: "Use POST with a label image. Not implemented yet." },
    { status: 501 },
  );
}
