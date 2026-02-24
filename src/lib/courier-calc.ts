/**
 * Shared courier net-payable calculation.
 *
 * net_payable = collectable_amount
 *   - (delivery_fee + cod_fee - discount - promo_discount + additional_charge + compensation_cost)
 *
 * Rules:
 *  1. If collectable_amount is null/0 → return { warning, netPayable: 0 }
 *  2. Round to 2 decimal places
 *  3. Never negative unless return shipment
 */

export interface CourierCharges {
  collectable_amount: number | null | undefined;
  courier_delivery_fee: number | null | undefined;
  courier_cod_fee: number | null | undefined;
  courier_discount: number | null | undefined;
  courier_promo_discount: number | null | undefined;
  courier_additional_charge: number | null | undefined;
  courier_compensation_cost: number | null | undefined;
  is_return?: boolean;
}

export interface NetPayableResult {
  totalCost: number;
  netPayable: number;
  warning: string | null;
  breakdown: string[];
}

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

export function calculateNetPayable(charges: CourierCharges): NetPayableResult {
  const collectable = n(charges.collectable_amount);
  const deliveryFee = n(charges.courier_delivery_fee);
  const codFee = n(charges.courier_cod_fee);
  const discount = n(charges.courier_discount);
  const promoDiscount = n(charges.courier_promo_discount);
  const additionalCharge = n(charges.courier_additional_charge);
  const compensationCost = n(charges.courier_compensation_cost);

  const totalCost = round2(deliveryFee + codFee - discount - promoDiscount + additionalCharge + compensationCost);

  let warning: string | null = null;
  if (!collectable) {
    warning = "Customer total missing. Net payable cannot be calculated.";
  }

  let netPayable = round2(collectable - totalCost);

  // Never negative unless return shipment
  if (netPayable < 0 && !charges.is_return) {
    netPayable = 0;
  }

  const breakdown = [
    `Collectable: ৳${collectable.toFixed(2)}`,
    `− Delivery Fee: ৳${deliveryFee.toFixed(2)}`,
    `− COD Fee: ৳${codFee.toFixed(2)}`,
    `+ Discount: ৳${discount.toFixed(2)}`,
    `+ Promo Discount: ৳${promoDiscount.toFixed(2)}`,
    `− Additional Charge: ৳${additionalCharge.toFixed(2)}`,
    `− Compensation Cost: ৳${compensationCost.toFixed(2)}`,
    `= Total Cost: ৳${totalCost.toFixed(2)}`,
    `= Net Payable: ৳${netPayable.toFixed(2)}`,
  ];

  return { totalCost, netPayable, warning, breakdown };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
