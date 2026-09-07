/**
 * Label extraction: one multimodal Claude call that reads a label image into
 * a LabelExtraction. No OCR-then-NLP pipeline — one hop, one thing to time.
 *
 * Runs only on the server (route handlers / scripts). The API key comes from
 * process.env.ANTHROPIC_API_KEY, which Next.js loads from .env.local.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { LabelExtraction } from "@/lib/types";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(type: string): type is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Default model; override with EXTRACTION_MODEL for latency/cost experiments. */
export const DEFAULT_EXTRACTION_MODEL = "claude-sonnet-5";

/**
 * What we ask the model to return. Mirrors LabelExtraction, but every optional
 * field is explicitly nullable so the structured-output schema is strict.
 */
export const LabelExtractionSchema = z.object({
  brandName: z.string().nullable().describe("Brand name exactly as printed, original casing."),
  classType: z
    .string()
    .nullable()
    .describe("Class/type designation as printed, e.g. 'Kentucky Straight Bourbon Whiskey'."),
  alcoholContent: z
    .number()
    .nullable()
    .describe("Alcohol by volume as a number, e.g. 45 for '45% Alc./Vol.'. Null if not printed."),
  netContents: z.string().nullable().describe("Net contents as printed, e.g. '750 mL' or '12 FL OZ'."),
  bottlerNameAddress: z
    .string()
    .nullable()
    .describe("Bottler/producer/importer name and address as printed, on one line."),
  countryOfOrigin: z
    .string()
    .nullable()
    .describe(
      "The country of origin ONLY if the label explicitly states one (e.g. 'Product of France' → 'France'). Return just the country name. Null otherwise.",
    ),
  governmentWarning: z
    .string()
    .nullable()
    .describe(
      "The full government warning text VERBATIM as printed, preserving the exact casing and punctuation of every word including the heading. Null if absent.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Your overall confidence that the fields above were read correctly, 0 to 1."),
  unreadableReason: z
    .string()
    .nullable()
    .describe(
      "If the image is too blurry, dark, skewed, or cropped to read reliably, a one-sentence plain-English reason. Null when the label is readable.",
    ),
});

export type LabelExtractionOutput = z.infer<typeof LabelExtractionSchema>;

const SYSTEM_PROMPT = `You read alcohol beverage labels for a U.S. TTB compliance reviewer.
Transcribe what is PRINTED on the label into the requested fields. Rules:
- Copy text exactly as printed. Never correct spelling, casing, or punctuation. Never fill in what "should" be there.
- If a field is not on the label, return null for it. Do not guess.
- alcoholContent is the percentage as a number (e.g. "45% Alc./Vol." -> 45). Ignore proof.
- countryOfOrigin comes only from a statement like "Product of France" or "Made in Italy"; return just the country ("France", "Italy"). An address is not a country of origin.
- governmentWarning must be the complete warning text verbatim, including the heading, with the original capitalization of every word. The heading's casing is evidence: if the label prints "Government Warning:" in title case, return exactly "Government Warning:" — never convert it to "GOVERNMENT WARNING:". Likewise never lowercase a heading that is printed in capitals.
- confidence reflects legibility. Below 0.5 means a reviewer should not trust these fields.
- If the image is not readable enough to transcribe reliably, set unreadableReason and still return whatever you could read.`;

export class ExtractionError extends Error {
  constructor(
    message: string,
    /** HTTP status the API route should use. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export interface ExtractionResult {
  extraction: LabelExtraction;
  /** Wall-clock milliseconds for the model call. Budget for the whole verdict is 5000. */
  durationMs: number;
  model: string;
  /** Token usage for the call, for latency/cost tuning. */
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Not every model accepts every parameter. `effort` is rejected by Haiku 4.5;
 * server-side `fallbacks` exist only on the Opus 5 / Fable tier. Keep the
 * per-model differences in one place so EXTRACTION_MODEL can be swapped freely.
 */
function modelOptions(model: string) {
  const supportsEffort = !/haiku/.test(model);
  const supportsFallbacks = /^claude-(opus-5|fable-5|mythos-5)/.test(model);
  // Day 2 experiments (docs/devlog.md): disabling thinking and fast mode were both
  // measured and dropped — no meaningful gain, and fast mode isn't enabled on this account.
  return {
    ...(supportsEffort ? { effort: "low" as const } : {}),
    ...(supportsFallbacks
      ? { fallbacks: "default" as const, betas: ["server-side-fallback-2026-07-01"] }
      : {}),
  };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionError(
      "The server is missing its ANTHROPIC_API_KEY. Add it to .env.local (or the host's environment) and restart.",
      500,
    );
  }
  // 15s cap and one retry: the product budget is 5s, so a hung call should fail fast.
  client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 });
  return client;
}

/** Convert the model's nullable output into the app's LabelExtraction shape. */
export function toLabelExtraction(out: LabelExtractionOutput): LabelExtraction {
  return {
    brandName: out.brandName,
    classType: out.classType,
    alcoholContent: out.alcoholContent,
    netContents: out.netContents,
    bottlerNameAddress: out.bottlerNameAddress,
    countryOfOrigin: out.countryOfOrigin,
    governmentWarning: out.governmentWarning,
    confidence: out.confidence,
    ...(out.unreadableReason ? { unreadableReason: out.unreadableReason } : {}),
  };
}

/**
 * Read one label image. Throws ExtractionError with a plain-English message
 * and an HTTP status for anything the caller should surface to the agent.
 */
export async function extractLabel(
  image: Buffer | Uint8Array,
  mediaType: SupportedImageType,
): Promise<ExtractionResult> {
  const anthropic = getClient();
  const model = process.env.EXTRACTION_MODEL ?? DEFAULT_EXTRACTION_MODEL;
  const data = Buffer.from(image).toString("base64");
  const { effort, betas, fallbacks } = modelOptions(model);
  const started = performance.now();

  let response;
  try {
    response = await anthropic.beta.messages.parse({
      model,
      max_tokens: 1024,
      // Reading a label is transcription, not reasoning: low effort keeps latency inside the budget.
      output_config: { ...(effort ? { effort } : {}), format: zodOutputFormat(LabelExtractionSchema) },
      // If a safety classifier declines, re-run on Anthropic's recommended fallback server-side.
      ...(betas ? { betas } : {}),
      ...(fallbacks ? { fallbacks } : {}),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: "Transcribe this label into the requested fields." },
          ],
        },
      ],
    });
  } catch (error) {
    throw mapApiError(error);
  }

  const durationMs = Math.round(performance.now() - started);

  if (response.stop_reason === "refusal") {
    throw new ExtractionError(
      "We couldn't process this image. Try a clearer photo of just the label.",
      422,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new ExtractionError("The label text was too long to read in one pass. Try a tighter crop.", 422);
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new ExtractionError("The label reader returned an unexpected result. Please try again.", 502);
  }

  return {
    extraction: toLabelExtraction(parsed),
    durationMs,
    model,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}

function mapApiError(error: unknown): ExtractionError {
  if (error instanceof ExtractionError) return error;
  if (error instanceof Anthropic.APIError) {
    // Server-side log keeps the real cause; the agent only ever sees the plain-English message.
    console.error(`extract: Anthropic API error ${error.status ?? "?"}: ${error.message}`);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ExtractionError("The server's ANTHROPIC_API_KEY was rejected. Check the key and restart.", 500);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ExtractionError("The label reader is busy right now. Wait a moment and try again.", 503);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ExtractionError(
      "The image couldn't be sent to the label reader. Use a JPEG, PNG, or WebP under 10 MB.",
      400,
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ExtractionError("Couldn't reach the label reader. Check the connection and try again.", 503);
  }
  if (error instanceof Anthropic.APIError) {
    return new ExtractionError(`The label reader returned an error (${error.status ?? "unknown"}). Try again.`, 502);
  }
  return new ExtractionError("Something went wrong while reading the label. Please try again.", 500);
}
