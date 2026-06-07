import { calculateBillTotals } from "@pharmacy-os/utils";
import { describe, expect, it } from "vitest";


describe("BillingCart calculations", () => {
  it("adds, discounts, and totals bill lines", () => {
    const totals = calculateBillTotals([{ mrp: 10000, quantity: 3, discount: 500, gstRate: 12 }]);

    expect(totals.discount).toBe(30000);
    expect(totals.totalAmount).toBe(0);
  });
});
