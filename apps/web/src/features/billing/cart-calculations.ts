import type { Medicine } from "@pharmacy-os/types";

export interface BillingCartItem {
  medicine: Medicine;
  quantity: number;
  discount: number;
}

export interface BillingCartLine extends BillingCartItem {
  gross: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export const calculateCart = (cart: BillingCartItem[]) => {
  const lines = cart.map<BillingCartLine>((item) => {
    const gross = item.medicine.mrp * item.quantity;
    const discountAmount = Math.round((gross * item.discount) / 100);
    const taxableAmount = gross - discountAmount;
    const gstAmount = Math.round((taxableAmount * item.medicine.gstRate) / 100);
    return {
      ...item,
      gross,
      discountAmount,
      taxableAmount,
      gstAmount,
      totalAmount: taxableAmount + gstAmount
    };
  });

  return {
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.gross, 0),
    gstAmount: lines.reduce((sum, line) => sum + line.gstAmount, 0),
    discount: lines.reduce((sum, line) => sum + line.discountAmount, 0),
    totalAmount: lines.reduce((sum, line) => sum + line.totalAmount, 0),
    gstBreakup: lines.reduce<Record<number, number>>((groups, line) => {
      groups[line.medicine.gstRate] = (groups[line.medicine.gstRate] ?? 0) + line.gstAmount;
      return groups;
    }, {})
  };
};
