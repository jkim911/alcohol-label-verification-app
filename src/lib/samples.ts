/**
 * Sample applications + label images for "Try a sample" in the UI.
 * Source of truth is fixtures/; `npm run samples:sync` copies the images to
 * public/samples/ so they're served statically. The JSON is bundled at build.
 */
import type { Application } from "@/lib/types";
import abvOffBy02 from "../../fixtures/applications/abv-off-by-0.2.json";
import addressAbbrevOk from "../../fixtures/applications/address-abbrev-ok.json";
import brandExtraWord from "../../fixtures/applications/brand-extra-word.json";
import importWithOriginOk from "../../fixtures/applications/import-with-origin-ok.json";
import abvOffBy1 from "../../fixtures/applications/abv-off-by-1.json";
import addressMismatch from "../../fixtures/applications/address-mismatch.json";
import blurry from "../../fixtures/applications/blurry-unreadable.json";
import classQualifierDrop from "../../fixtures/applications/class-qualifier-drop.json";
import classTypeReorder from "../../fixtures/applications/class-type-reorder.json";
import importMissingOrigin from "../../fixtures/applications/import-missing-origin.json";
import netContentsUnitDiff from "../../fixtures/applications/net-contents-unit-diff.json";
import stonesThrowOk from "../../fixtures/applications/stones-throw-ok.json";
import warningLowercase from "../../fixtures/applications/warning-lowercase.json";
import warningReworded from "../../fixtures/applications/warning-reworded.json";

export interface Sample {
  id: string;
  /** Short, plain description of what the sample demonstrates. */
  title: string;
  application: Application;
  imageUrl: string;
}

const entries: Array<[string, Application]> = [
  ["Everything matches (brand casing differs)", stonesThrowOk as Application],
  ["Alcohol content off by 1 point", abvOffBy1 as Application],
  ["Alcohol content off by 0.2 (within tolerance)", abvOffBy02 as Application],
  ["Government warning reworded", warningReworded as Application],
  ["Government warning heading not in capitals", warningLowercase as Application],
  ["Bottler city doesn't match", addressMismatch as Application],
  ["Import with no country of origin", importMissingOrigin as Application],
  ["'Straight' missing from class/type", classQualifierDrop as Application],
  ["Class/type words in a different order", classTypeReorder as Application],
  ["Net contents in different units", netContentsUnitDiff as Application],
  ["Blurry photo (can't be read)", blurry as Application],
  ["Street abbreviated on label (Road → Rd.)", addressAbbrevOk as Application],
  ["Import with 'Product of Italy' printed", importWithOriginOk as Application],
  ["Label adds a word to the brand name", brandExtraWord as Application],
];

export const SAMPLES: Sample[] = entries.map(([title, application]) => ({
  id: application.id,
  title,
  application,
  imageUrl: `/samples/${application.id}.png`,
}));
