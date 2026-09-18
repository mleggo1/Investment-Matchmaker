import dataset from "./etf-canonical.json";
import {
  getEducatorEtfs,
  formatMerDisplay,
  formatReturnDisplay,
  formatYieldDisplay,
} from "./etfCanonical.js";

export const canonicalDataset = dataset;
export const EDUCATOR_ETFS = getEducatorEtfs(dataset);
export { formatMerDisplay, formatReturnDisplay, formatYieldDisplay };
