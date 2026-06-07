
import { amountInWords, formatCurrency, formatDateTime } from "@pharmacy-os/utils";
import type { Bill, BillItem, Medicine, Pharmacy } from "@prisma/client";
import PDFDocument from "pdfkit";

const amountWordsForInvoice = (amount: number): string => {
  const words = amountInWords(amount).replace(/\s*rupees\s+only$/i, "");
  return `Rupees ${words} Only`;
};

const discountPercentFor = (item: BillItem): string => {
  const gross = item.mrp * item.quantity;
  if (gross <= 0) return "0%";
  return `${((item.discount / gross) * 100).toFixed(2).replace(/\.00$/, "")}%`;
};

const gstBreakup = (items: BillItem[]): { rate: number; taxable: number; tax: number }[] => {
  const grouped = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const item of items) {
    const gross = item.mrp * item.quantity;
    const taxable = Math.max(0, gross - item.discount);
    const tax = Math.round((taxable * item.gstRate) / 100);
    const existing = grouped.get(item.gstRate) ?? { rate: item.gstRate, taxable: 0, tax: 0 };
    existing.taxable += taxable;
    existing.tax += tax;
    grouped.set(item.gstRate, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => a.rate - b.rate);
};

export const createInvoicePdf = async (
  pharmacy: Pharmacy,
  bill: Bill & { items: (BillItem & { medicine: Medicine })[] },
  duplicate = false
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 48, size: "A4" });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => { resolve(Buffer.concat(chunks)); });
  });

  doc.fontSize(20).fillColor("#0A1628").text(pharmacy.name, { align: "left" });
  doc.fontSize(9).fillColor("#334155").text(`${pharmacy.address}, ${pharmacy.city}, ${pharmacy.state} - ${pharmacy.pinCode}`);
  doc.text(`License No: ${pharmacy.licenseNo}${pharmacy.gstin ? ` | GSTIN: ${pharmacy.gstin}` : ""} | Phone: ${pharmacy.phone}`);
  doc.moveDown();

  if (duplicate) {
    doc.save().rotate(-35, { origin: [250, 350] });
    doc.fontSize(56).fillColor("#9CA3AF").opacity(0.16).text("DUPLICATE", 105, 320);
    doc.restore();
    doc.opacity(1).fillColor("#0A1628");
  }

  doc.fontSize(14).text(`Bill No: ${bill.billNo}`);
  doc.fontSize(10).text(`Date: ${formatDateTime(bill.createdAt)}`);
  doc.text(`Patient: ${bill.patientName ?? "Walk-in customer"}`);
  doc.text(`Doctor: ${bill.doctorName ?? "-"}`);
  doc.moveDown();

  const startY = doc.y;
  const columns = [48, 190, 240, 280, 335, 390, 455];
  doc.fontSize(9).fillColor("#0A1628");
  doc.text("Medicine", columns[0], startY);
  doc.text("HSN", columns[1], startY);
  doc.text("Qty", columns[2], startY);
  doc.text("MRP", columns[3], startY);
  doc.text("Disc %", columns[4], startY);
  doc.text("GST %", columns[5], startY);
  doc.text("Amount", columns[6], startY);
  doc.moveTo(48, startY + 16).lineTo(545, startY + 16).strokeColor("#CBD5E1").stroke();
  doc.moveDown();

  bill.items.forEach((item) => {
    const y = doc.y + 6;
    doc.fillColor("#334155").fontSize(9);
    doc.text(item.medicine.name, columns[0], y, { width: 150 });
    doc.text(item.medicine.hsnCode, columns[1], y);
    doc.text(String(item.quantity), columns[2], y);
    doc.text(formatCurrency(item.mrp), columns[3], y);
    doc.text(discountPercentFor(item), columns[4], y);
    doc.text(`${item.gstRate}%`, columns[5], y);
    doc.text(formatCurrency(item.amount), columns[6], y);
    doc.moveDown(0.8);
  });

  doc.moveDown();
  doc.moveTo(330, doc.y).lineTo(545, doc.y).strokeColor("#CBD5E1").stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#0A1628");
  doc.text(`Subtotal: ${formatCurrency(bill.subtotal)}`, { align: "right" });
  for (const breakup of gstBreakup(bill.items)) {
    doc.text(`GST ${breakup.rate}%: ${formatCurrency(breakup.tax)} on ${formatCurrency(breakup.taxable)}`, { align: "right" });
  }
  doc.text(`Total discount: ${formatCurrency(bill.discount)}`, { align: "right" });
  doc.fontSize(14).text(`GRAND TOTAL: ${formatCurrency(bill.totalAmount)}`, { align: "right" });
  doc.fontSize(9).fillColor("#334155").text(amountWordsForInvoice(bill.totalAmount), { align: "right" });

  doc.fontSize(9).fillColor("#64748B").text("Thank you for your visit", 48, 780, { align: "center", width: 497 });

  doc.end();
  return done;
};
