import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(
  readFileSync(path.join(__dirname, "../src/data/etf-canonical.json"), "utf8")
);

const SHARED = [
  "XASX:IVV",
  "XASX:NDQ",
  "XASX:RBTZ",
  "XASX:CRYP",
  "XASX:VHY",
  "XASX:VAP",
  "XASX:IOO",
  "XASX:VAF",
];

test("educator copy identifies funds by exchange and ticker", () => {
  for (const id of SHARED) {
    const instrument = dataset.instruments.find((item) => item.id === id);
    assert.ok(instrument, `${id} missing from educator canonical copy`);
    assert.equal(instrument.id, `${instrument.exchange}:${instrument.ticker}`);
    assert.equal(instrument.exchange, "XASX");
  }
});

test("ASX IVV in the educator copy is not the NYSE Arca fund", () => {
  const ivv = dataset.instruments.find((item) => item.id === "XASX:IVV");
  assert.equal(ivv.isin, "AU000000IVV8");
  assert.equal(ivv.currency, "AUD");
  assert.equal(ivv.managementFee.percentPoints, 0.04);
  assert.equal(dataset.instruments.some((item) => item.id === "NYSEARCA:IVV"), false);
});

test("educator copy keeps CRYP 5y null and VAF yield null", () => {
  const cryp = dataset.instruments.find((item) => item.id === "XASX:CRYP");
  const vaf = dataset.instruments.find((item) => item.id === "XASX:VAF");
  assert.equal(cryp.return5y.percentPoints, null);
  assert.equal(vaf.yield.percentPoints, null);
  assert.notEqual(vaf.return5y.percentPoints, 0);
});
