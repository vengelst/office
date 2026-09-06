/**
 * Positions-Netto nach Rabatt (verbindliche Formel Phase 2).
 * gross = qty * unitPrice
 * discount = discountAmount ?? gross * (discountPercent/100)
 * lineNet = max(0, gross - discount)
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeLineNet(input: {
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
}): number {
  const quantity = input.quantity ?? 0;
  const unitPrice = input.unitPrice ?? 0;
  const gross = round2(quantity * unitPrice);
  let discount = 0;
  if (input.discountAmount != null && !Number.isNaN(input.discountAmount)) {
    discount = input.discountAmount;
  } else if (
    input.discountPercent != null &&
    !Number.isNaN(input.discountPercent)
  ) {
    discount = round2((gross * input.discountPercent) / 100);
  }
  return Math.max(0, round2(gross - discount));
}
