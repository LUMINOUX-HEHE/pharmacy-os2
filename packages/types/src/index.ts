export const APP_TIMEZONE = "Asia/Kolkata" as const;

export enum UserRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  BILLING_STAFF = "BILLING_STAFF",
  DELIVERY = "DELIVERY"
}

export enum StaffRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  BILLING = "BILLING",
  DELIVERY = "DELIVERY"
}

export enum PharmacyPlan {
  STARTER = "STARTER",
  GROWTH = "GROWTH",
  ENTERPRISE = "ENTERPRISE"
}

export enum ScheduleType {
  GENERAL = "GENERAL",
  H = "H",
  H1 = "H1",
  X = "X"
}

export enum MedicineCategory {
  TABLET = "TABLET",
  CAPSULE = "CAPSULE",
  SYRUP = "SYRUP",
  INJECTION = "INJECTION",
  CREAM = "CREAM",
  OINTMENT = "OINTMENT",
  DROPS = "DROPS",
  INHALER = "INHALER",
  DEVICE = "DEVICE",
  SUPPLEMENT = "SUPPLEMENT"
}

export enum PaymentMode {
  CASH = "CASH",
  UPI = "UPI",
  CARD = "CARD",
  CREDIT = "CREDIT"
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED"
}

export enum BillStatus {
  DRAFT = "DRAFT",
  PAID = "PAID",
  CREDIT = "CREDIT",
  VOID = "VOID"
}

export enum OrderStatus {
  NEW = "NEW",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED"
}

export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED"
}

export enum CreditLedgerType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT"
}

export enum ReminderFrequency {
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY"
}

export enum DeliveryStatus {
  ASSIGNED = "ASSIGNED",
  PICKED_UP = "PICKED_UP",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED"
}

export enum SubscriptionStatus {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED"
}

export enum ErrorCode {
  AUTH_001 = "AUTH_001",
  AUTH_002 = "AUTH_002",
  AUTH_003 = "AUTH_003",
  INV_001 = "INV_001",
  INV_002 = "INV_002",
  BILL_001 = "BILL_001",
  BILL_002 = "BILL_002",
  ORDER_001 = "ORDER_001",
  CUSTOMER_001 = "CUSTOMER_001",
  VALIDATION_001 = "VALIDATION_001",
  SYSTEM_001 = "SYSTEM_001"
}

export type ISODateString = string;
export type CurrencyPaise = number;

export interface ApiMeta {
  requestId?: string;
  timestamp?: ISODateString;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  code: ErrorCode;
  meta?: ApiMeta & {
    issues?: {
      path: string;
      message: string;
    }[];
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  licenseNo: string;
  gstin: string | null;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  logoUrl: string | null;
  plan: PharmacyPlan;
  planExpiresAt: ISODateString | null;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  pharmacyId: string | null;
  isVerified: boolean;
  createdAt: ISODateString;
}

export interface Staff {
  id: string;
  userId: string;
  pharmacyId: string;
  role: StaffRole;
}

export interface Medicine {
  id: string;
  pharmacyId: string;
  name: string;
  genericName: string;
  sku: string;
  category: MedicineCategory;
  manufacturer: string;
  batchNo: string;
  expiryDate: ISODateString;
  mfgDate: ISODateString;
  mrp: CurrencyPaise;
  purchasePrice: CurrencyPaise;
  gstRate: number;
  hsnCode: string;
  stockQty: number;
  reorderLevel: number;
  scheduleType: ScheduleType;
  barcodeId: string | null;
  isOnline: boolean;
  onlinePrice: CurrencyPaise | null;
  isActive: boolean;
}

export interface BillItem {
  id: string;
  billId: string;
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  mrp: CurrencyPaise;
  discount: CurrencyPaise;
  gstRate: number;
  amount: CurrencyPaise;
}

export interface Bill {
  id: string;
  pharmacyId: string;
  billNo: string;
  patientName: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  prescriptionUrl: string | null;
  paymentMode: PaymentMode;
  subtotal: CurrencyPaise;
  gstAmount: CurrencyPaise;
  discount: CurrencyPaise;
  totalAmount: CurrencyPaise;
  status: BillStatus;
  createdBy: string;
  createdAt: ISODateString;
  items?: BillItem[];
}

export interface Customer {
  id: string;
  pharmacyId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  creditBalance: CurrencyPaise;
  tags: string[];
  birthday: ISODateString | null;
  isActive: boolean;
}

export interface CreditLedger {
  id: string;
  customerId: string;
  type: CreditLedgerType;
  amount: CurrencyPaise;
  description: string;
  billId: string | null;
  createdAt: ISODateString;
}

export interface Reminder {
  id: string;
  pharmacyId: string;
  customerId: string;
  medicineId: string;
  frequency: ReminderFrequency;
  nextSendAt: ISODateString;
  isActive: boolean;
  lastSentAt: ISODateString | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  price: CurrencyPaise;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  timestamp: ISODateString;
  note: string;
}

export interface Order {
  id: string;
  pharmacyId: string;
  customerId: string;
  status: OrderStatus;
  subtotal: CurrencyPaise;
  deliveryFee: CurrencyPaise;
  total: CurrencyPaise;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  razorpayOrderId: string | null;
  deliveryDriverId: string | null;
  prescriptionUrl: string | null;
  notes: string | null;
  createdAt: ISODateString;
  items?: OrderItem[];
  customer?: Customer;
  timeline?: OrderTimelineEntry[];
}

export interface Distributor {
  id: string;
  pharmacyId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  categories: MedicineCategory[];
  gstin: string | null;
  isActive: boolean;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  purchasePrice: CurrencyPaise;
}

export interface PurchaseOrder {
  id: string;
  pharmacyId: string;
  distributorId: string;
  distributor?: Distributor;
  status: PurchaseOrderStatus;
  totalAmount: CurrencyPaise;
  notes: string | null;
  sentAt: ISODateString | null;
  receivedAt: ISODateString | null;
  createdAt: ISODateString;
  items?: PurchaseOrderItem[];
}

export interface DeliveryDriver {
  id: string;
  pharmacyId: string;
  name: string;
  phone: string;
  vehicle: string;
  isActive: boolean;
}

export interface Delivery {
  id: string;
  orderId: string;
  driverId: string;
  status: DeliveryStatus;
  assignedAt: ISODateString;
  deliveredAt: ISODateString | null;
  notes: string | null;
}

export interface AnalyticsSnapshot {
  id: string;
  pharmacyId: string;
  date: ISODateString;
  revenue: CurrencyPaise;
  orders: number;
  newCustomers: number;
  topSku: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
  pharmacy: Pharmacy | null;
  permissions: string[];
}

export interface DashboardSummary {
  revenueToday: CurrencyPaise;
  ordersToday: number;
  lowStockAlerts: number;
  expiryAlerts: number;
  revenueTrend: { date: string; revenue: CurrencyPaise }[];
  topMedicines: { name: string; quantity: number }[];
  recentActivity: { id: string; label: string; createdAt: ISODateString }[];
}

export interface StorefrontCatalogue {
  pharmacy: Pharmacy;
  medicines: Medicine[];
}

export interface OfflineBillDraft {
  idempotencyKey: string;
  patientName: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  paymentMode: PaymentMode;
  items: {
    medicineId: string;
    quantity: number;
    discount: number;
  }[];
  createdAt: ISODateString;
}
