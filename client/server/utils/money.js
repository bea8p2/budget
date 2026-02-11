// server/utils/money.js
export function roundToCents(n) {
  // Safely round to 2 decimals, returns a Number like -45.2 (not a string)
  // Note: This rounds half away from zero due to Math.round behavior on positives/negatives.
  // For banker's rounding, you'd use a different strategy.
  return Math.round(Number(n) * 100) / 100;
}

export function ensureTwoDecimals(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return null;
  return roundToCents(x);
}