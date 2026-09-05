/**
 * Bottler name/address segmentation. Labels print addresses in many shapes;
 * this handles the common "Name, Street, City, ST 12345" form and degrades
 * to whole-string comparison when it can't.
 */
import { normalize } from "./text";

export interface AddressParts {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  lane: "ln",
  ln: "ln",
  boulevard: "blvd",
  blvd: "blvd",
  court: "ct",
  ct: "ct",
  place: "pl",
  pl: "pl",
  highway: "hwy",
  hwy: "hwy",
  parkway: "pkwy",
  pkwy: "pkwy",
  way: "way",
  row: "row",
  north: "n",
  n: "n",
  south: "s",
  s: "s",
  east: "e",
  e: "e",
  west: "w",
  w: "w",
  suite: "ste",
  ste: "ste",
};

/** Phrases that describe the relationship, not the company. */
const ROLE_PREFIX = /^(imported|bottled|distilled|produced|brewed|vinted|packed|made)\s+(and\s+\w+\s+)?by\s+/i;

export function stripRolePrefix(name: string): string {
  return name.replace(ROLE_PREFIX, "").trim();
}

/** Collapse "Street"→"st", "Avenue"→"ave" etc. so common abbreviations compare equal. */
export function normalizeStreet(street: string): string {
  return normalize(street)
    .replace(/[.,]/g, "")
    .split(" ")
    .map((w) => STREET_ABBREVIATIONS[w] ?? w)
    .join(" ");
}

/** Returns null when the text doesn't end in "City, ST 12345[-6789]". */
export function parseAddress(text: string | null | undefined): AddressParts | null {
  if (!text) return null;
  const m = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(.*?),\s*([^,]+?),\s*([A-Za-z]{2})\.?\s+(\d{5})(?:-\d{4})?\.?$/);
  if (!m) return null;
  const head = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  if (head.length === 0) return null;
  const name = stripRolePrefix(head[0]);
  const street = head.slice(1).join(", ");
  return { name, street, city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] };
}
