import { amountInWords, formatCurrency, formatPaise } from "@pharmacy-os/utils";
import { describe, expect, it } from "vitest";

describe("currency utilities", () => {
  it("formats paise as Indian rupee currency", () => {
    expect(formatCurrency(123456)).toBe("₹1,234.56");
    expect(formatPaise(500)).toBe("₹5.00");
    expect(formatPaise(0)).toBe("₹0.00");
  });

  it("converts paise amounts to Indian rupee words", () => {
    expect(amountInWords(0)).toBe("Zero rupees only");
    expect(amountInWords(42000)).toBe("Four Hundred Twenty rupees only");
    expect(amountInWords(123456789)).toBe("Twelve Lakh Thirty Four Thousand Five Hundred Sixty Eight rupees only");
  });
});
