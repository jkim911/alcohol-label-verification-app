import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(form: FormData) {
  return POST(new Request("http://localhost/api/review", { method: "POST", body: form }));
}

describe("POST /api/review validation", () => {
  it("400 without an image", async () => {
    const form = new FormData();
    form.append("application", "{}");
    const res = await post(form);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Choose a label image/);
  });

  it("400 without application details", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(10)], "l.png", { type: "image/png" }));
    const res = await post(form);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Fill in/);
  });

  it("400 with a named reason when a required field is blank", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(10)], "l.png", { type: "image/png" }));
    form.append(
      "application",
      JSON.stringify({ productType: "spirits", brandName: "", classType: "Gin", netContents: "750 mL", bottlerNameAddress: "x" }),
    );
    const res = await post(form);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/brandName: Brand name is required/);
  });
});
