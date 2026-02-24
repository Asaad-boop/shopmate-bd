import { describe, it, expect } from "vitest";
import { calculateNetPayable } from "@/lib/courier-calc";

describe("calculateNetPayable – decimal precision", () => {
  it("preserves COD fee 4.55", () => {
    const result = calculateNetPayable({
      collectable_amount: 500,
      courier_delivery_fee: 60,
      courier_cod_fee: 4.55,
      courier_discount: 0,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
    });
    expect(result.totalCost).toBe(64.55);
    expect(result.netPayable).toBe(435.45);
  });

  it("preserves COD fee 7.50", () => {
    const result = calculateNetPayable({
      collectable_amount: 1000,
      courier_delivery_fee: 80,
      courier_cod_fee: 7.5,
      courier_discount: 10,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
    });
    expect(result.totalCost).toBe(77.5);
    expect(result.netPayable).toBe(922.5);
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateNetPayable({
      collectable_amount: 455,
      courier_delivery_fee: 60,
      courier_cod_fee: 4.555,
      courier_discount: 0,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
    });
    // 60 + 4.555 = 64.555 → rounded to 64.56
    expect(result.totalCost).toBe(64.56);
    // 455 - 64.56 = 390.44
    expect(result.netPayable).toBe(390.44);
  });

  it("clamps negative to 0 for non-return", () => {
    const result = calculateNetPayable({
      collectable_amount: 50,
      courier_delivery_fee: 60,
      courier_cod_fee: 5,
      courier_discount: 0,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
    });
    expect(result.netPayable).toBe(0);
  });

  it("allows negative for return shipments", () => {
    const result = calculateNetPayable({
      collectable_amount: 50,
      courier_delivery_fee: 60,
      courier_cod_fee: 5,
      courier_discount: 0,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
      is_return: true,
    });
    expect(result.netPayable).toBe(-15);
  });

  it("warns when collectable_amount is 0", () => {
    const result = calculateNetPayable({
      collectable_amount: 0,
      courier_delivery_fee: 60,
      courier_cod_fee: 7.5,
      courier_discount: 0,
      courier_promo_discount: 0,
      courier_additional_charge: 0,
      courier_compensation_cost: 0,
    });
    expect(result.warning).toBeTruthy();
  });

  it("full formula with all fields and decimals", () => {
    const result = calculateNetPayable({
      collectable_amount: 1500,
      courier_delivery_fee: 80,
      courier_cod_fee: 15.75,
      courier_discount: 10.25,
      courier_promo_discount: 5.50,
      courier_additional_charge: 20,
      courier_compensation_cost: 0,
    });
    // totalCost = 80 + 15.75 - 10.25 - 5.50 + 20 + 0 = 100
    expect(result.totalCost).toBe(100);
    expect(result.netPayable).toBe(1400);
  });
});
