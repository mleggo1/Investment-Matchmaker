import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataset = JSON.parse(readFileSync(path.join(root, "src/data/etf-canonical.json"), "utf8"));
const canonical = await import(pathToFileURL(path.join(root, "src/data/etfCanonical.js")).href);
const result = canonical.validateDataset(dataset, { now: new Date() });

if (!result.ok) {
  console.error("ETF dataset is not current or failed validation:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `ETF dataset ${dataset.datasetVersion} retrieved ${dataset.retrievedAt} passed validation (${dataset.instruments.length} instruments).`,
);
