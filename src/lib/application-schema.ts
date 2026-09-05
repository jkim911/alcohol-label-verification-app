/**
 * Validation for application data arriving from the browser (form or CSV).
 */
import { z } from "zod";
import type { Application } from "@/lib/types";

export const ApplicationSchema = z.object({
  id: z.string().trim().min(1).max(100).default("single"),
  productType: z.enum(["beer", "wine", "spirits"]),
  brandName: z.string().trim().min(1, "Brand name is required").max(200),
  classType: z.string().trim().min(1, "Class/type is required").max(200),
  alcoholContent: z
    .union([z.number(), z.string().trim()])
    .nullable()
    .transform((v) => {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }),
  netContents: z.string().trim().min(1, "Net contents is required").max(100),
  bottlerNameAddress: z.string().trim().min(1, "Bottler name and address is required").max(400),
  isImport: z.boolean().default(false),
  countryOfOrigin: z
    .string()
    .trim()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type ApplicationInput = z.input<typeof ApplicationSchema>;

export function parseApplication(raw: unknown): { application: Application } | { error: string } {
  const result = ApplicationSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first.path.join(".");
    return { error: `${where ? `${where}: ` : ""}${first.message}` };
  }
  return { application: result.data as Application };
}
