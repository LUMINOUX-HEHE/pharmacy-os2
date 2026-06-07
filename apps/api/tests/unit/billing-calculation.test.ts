import { describe, expect, it } from "@jest/globals";
import { amountInWords, calculateBillTotals } from "@pharmacy-os/utils";

describe("billing calculation", () => {
  it.each([
    [5, 10500],
    [12, 11200],
    [18, 11800]
  ])("calculates GST at %i percent after discount", (gstRate, expectedTotal) => {
    const totals = calculateBillTotals([{ mrp: 10000, quantity: 1, discount: 0, gstRate }]);
    expect(totals.subtotal).toBe(10000);
    expect(totals.gstAmount).toBe(expectedTotal - 10000);
    expect(totals.totalAmount).toBe(expectedTotal);
  });

  it("applies discount before GST and computes total = subtotal + GST - discount", () => {
    const totals = calculateBillTotals([{ mrp: 20000, quantity: 2, discount: 10, gstRate: 12 }]);
    expect(totals.subtotal).toBe(40000);
    expect(totals.discount).toBe(4000);
    expect(totals.gstAmount).toBe(4320);
    expect(totals.totalAmount).toBe(40320);
  });

  it("does not calculate GST on the discounted amount", () => {
    const totals = calculateBillTotals([{ mrp: 10000, quantity: 3, discount: 25, gstRate: 18 }]);
    expect(totals.subtotal).toBe(30000);
    expect(totals.discount).toBe(7500);
    expect(totals.gstAmount).toBe(4050);
    expect(totals.totalAmount).toBe(26550);
  });

  it("clamps excessive discounts before calculating GST", () => {
    const totals = calculateBillTotals([{ mrp: 10000, quantity: 1, discount: 125, gstRate: 12 }]);
    expect(totals.subtotal).toBe(10000);
    expect(totals.discount).toBe(10000);
    expect(totals.gstAmount).toBe(0);
    expect(totals.totalAmount).toBe(0);
  });

  it("converts amount to Indian words", () => {
    expect(amountInWords(42000)).toBe("Four Hundred Twenty rupees only");
    expect(amountInWords(123456789)).toBe("Twelve Lakh Thirty Four Thousand Five Hundred Sixty Eight rupees only");
  });
});
