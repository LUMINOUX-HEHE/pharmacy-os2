import type {
  BillItem,
  CurrencyPaise,
  PaginatedResult,
  ReminderFrequency
} from "@pharmacy-os/types";
import { addMonths, addQuarters, addWeeks, format, parseISO } from "date-fns";


type ReminderFrequencyValue = ReminderFrequency | "WEEKLY" | "MONTHLY" | "QUARTERLY";

export const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

export const formatCurrency = (paise: CurrencyPaise): string => INR_FORMATTER.format(paise / 100);

export const formatPaise = (paise: CurrencyPaise): string => formatCurrency(paise);

export const parseRupeesToPaise = (value: string | number): CurrencyPaise => {
  const numeric = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid currency value");
  }
  return Math.round(numeric * 100);
};

export const formatDate = (value: string | Date, pattern = "dd MMM yyyy"): string => {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
};

export const formatDateTime = (value: string | Date): string => formatDate(value, "dd MMM yyyy, hh:mm a");

export const createPagination = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> => ({
  data,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit))
});

export const getPaginationParams = (
  pageValue: unknown,
  limitValue: unknown,
  defaults = { page: 1, limit: 25 }
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, Number(pageValue ?? defaults.page) || defaults.page);
  const limit = Math.min(100, Math.max(1, Number(limitValue ?? defaults.limit) || defaults.limit));
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

export interface BillLineInput {
  quantity: number;
  mrp: CurrencyPaise;
  discount: number;
  gstRate: number;
}

export interface BillTotals {
  subtotal: CurrencyPaise;
  gstAmount: CurrencyPaise;
  discount: CurrencyPaise;
  totalAmount: CurrencyPaise;
  items: Pick<BillItem, "quantity" | "mrp" | "discount" | "gstRate" | "amount">[];
}

export const calculateBillTotals = (lines: BillLineInput[]): BillTotals => {
  return lines.reduce<BillTotals>(
    (totals, line) => {
      const gross = line.mrp * line.quantity;
      const discount = Math.round((gross * Math.min(100, Math.max(0, line.discount))) / 100);
      const taxable = gross - discount;
      const gstAmount = Math.round((taxable * line.gstRate) / 100);
      const amount = taxable + gstAmount;

      totals.subtotal += gross;
      totals.gstAmount += gstAmount;
      totals.discount += discount;
      totals.totalAmount += amount;
      totals.items.push({
        quantity: line.quantity,
        mrp: line.mrp,
        discount,
        gstRate: line.gstRate,
        amount
      });

      return totals;
    },
    {
      subtotal: 0,
      gstAmount: 0,
      discount: 0,
      totalAmount: 0,
      items: []
    }
  );
};

export const nextReminderDate = (from: Date, frequency: ReminderFrequencyValue): Date => {
  switch (String(frequency)) {
    case "WEEKLY":
      return addWeeks(from, 1);
    case "MONTHLY":
      return addMonths(from, 1);
    case "QUARTERLY":
      return addQuarters(from, 1);
    default:
      throw new Error(`Unsupported reminder frequency: ${String(frequency)}`);
  }
};

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
};

export const amountInWords = (paise: CurrencyPaise): string => {
  const rupees = Math.round(paise / 100);
  if (rupees === 0) {
    return "Zero rupees only";
  }

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertBelowThousand = (number: number): string => {
    const hundred = Math.floor(number / 100);
    const rest = number % 100;
    const parts: string[] = [];
    if (hundred > 0) {
      parts.push(`${ones[hundred]} Hundred`);
    }
    if (rest > 0) {
      if (rest < 20) {
        parts.push(ones[rest] ?? "");
      } else {
        const ten = Math.floor(rest / 10);
        const one = rest % 10;
        parts.push(`${tens[ten]}${one ? ` ${ones[one]}` : ""}`);
      }
    }
    return parts.join(" ");
  };

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];

  if (crore) parts.push(`${convertBelowThousand(crore)} Crore`);
  if (lakh) parts.push(`${convertBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${convertBelowThousand(thousand)} Thousand`);
  if (rest) parts.push(convertBelowThousand(rest));

  return `${parts.join(" ")} rupees only`;
};

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};
