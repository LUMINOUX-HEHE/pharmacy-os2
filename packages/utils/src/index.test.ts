import { describe, expect, it } from "vitest";

import { amountInWords, calculateBillTotals, formatCurrency, formatPaise, nextReminderDate } from "./index";

describe("currency helpers", () => {
  it("formats paise in Indian rupees", () => {
    expect(formatCurrency(420000)).toBe("₹4,200.00");
    expect(formatPaise(420000)).toBe("₹4,200.00");
  });
});

describe("billing calculations", () => {
  it("calculates GST, percent discount, and grand total", () => {
    const totals = calculateBillTotals([{ mrp: 11800, quantity: 2, discount: 10, gstRate: 18 }]);

    expect(totals.subtotal).toBe(23600);
    expect(totals.discount).toBe(2360);
    expect(totals.gstAmount).toBe(3823);
    expect(totals.totalAmount).toBe(25063);
  });
});

describe("reminder scheduling", () => {
  it("moves monthly reminders by one month", () => {
    expect(nextReminderDate(new Date("2026-05-04T00:00:00.000Z"), "MONTHLY").toISOString()).toBe(
      "2026-06-04T00:00:00.000Z"
    );
  });
});

describe("amount in words", () => {
  it("supports Indian number groups", () => {
    expect(amountInWords(123456700)).toBe("Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven rupees only");
  });
});
