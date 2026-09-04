/**
 * Input validation only — these never reach the Claude API.
 */
import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

function post(body?: BodyInit) {
  return POST(new Request("http://localhost/api/extract", { method: "POST", body }));
}

describe("POST /api/extract validation", () => {
  it("400 when the body is not a form", async () => {
    const res = await post("not a form");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/form upload/);
  });

  it("400 when no image is attached", async () => {
    const res = await post(new FormData());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Choose a label image/);
  });

  it("400 for an unsupported file type", async () => {
    const form = new FormData();
    form.append("image", new File(["%PDF-1.4"], "label.pdf", { type: "application/pdf" }));
    const res = await post(form);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JPEG, PNG, or WebP/);
  });

  it("400 for an image over 10 MB", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    const res = await post(form);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/over 10 MB/);
  });
});

describe("GET /api/extract", () => {
  it("405 with a hint to POST", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
