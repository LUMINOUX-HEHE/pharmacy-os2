import { ErrorCode } from "@pharmacy-os/types";
import { createPagination, getPaginationParams, slugify } from "@pharmacy-os/utils";
import { MedicineCategory, type Medicine, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { addQueueJob, reorderAlertQueue } from "../../jobs/queues.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { AppError } from "../../utils/app-error.js";

import type { inventoryQuerySchema} from "./schemas.js";
import { medicineSchema } from "./schemas.js";

type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
type BulkMedicineInput = z.infer<typeof medicineSchema> & { sku: string };

interface BulkImportError {
  row: number;
  sku?: string;
  message: string;
  issues?: { path: string; message: string }[];
}

const categoryAliases: Record<string, MedicineCategory> = {
  tablet: MedicineCategory.TABLET,
  tablets: MedicineCategory.TABLET,
  capsule: MedicineCategory.CAPSULE,
  capsules: MedicineCategory.CAPSULE,
  syrup: MedicineCategory.SYRUP,
  syrups: MedicineCategory.SYRUP,
  injection: MedicineCategory.INJECTION,
  injections: MedicineCategory.INJECTION,
  cream: MedicineCategory.CREAM,
  creams: MedicineCategory.CREAM,
  creamsandointments: MedicineCategory.CREAM,
  creamsointments: MedicineCategory.CREAM,
  ointment: MedicineCategory.OINTMENT,
  ointments: MedicineCategory.OINTMENT,
  eyeeardrops: MedicineCategory.DROPS,
  drops: MedicineCategory.DROPS,
  inhaler: MedicineCategory.INHALER,
  inhalers: MedicineCategory.INHALER,
  medicaldevices: MedicineCategory.DEVICE,
  device: MedicineCategory.DEVICE,
  devices: MedicineCategory.DEVICE,
  vitaminsandsupplements: MedicineCategory.SUPPLEMENT,
  supplement: MedicineCategory.SUPPLEMENT,
  supplements: MedicineCategory.SUPPLEMENT,
  ayurvedic: MedicineCategory.SUPPLEMENT,
  otcproducts: MedicineCategory.TABLET
};

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeCategory = (value: string): MedicineCategory | null => {
  const upper = value.toUpperCase();
  if ((Object.values(MedicineCategory) as string[]).includes(upper)) {
    return upper as MedicineCategory;
  }
  return categoryAliases[normalizeToken(value)] ?? null;
};

const normalizeStockStatus = (value?: string): "in_stock" | "low_stock" | "out_of_stock" | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "available") return "in_stock";
  if (normalized === "low") return "low_stock";
  if (normalized === "out") return "out_of_stock";
  if (["in_stock", "low_stock", "out_of_stock"].includes(normalized)) {
    return normalized as "in_stock" | "low_stock" | "out_of_stock";
  }
  return undefined;
};

const normalizeSortField = (sort: InventoryQuery["sort"]): "name" | "stockQty" | "expiryDate" | "mrp" => {
  if (sort === "stock") return "stockQty";
  if (sort === "expiry") return "expiryDate";
  if (sort === "price") return "mrp";
  if (sort === "stockQty" || sort === "expiryDate" || sort === "mrp") return sort;
  return "name";
};

const applyStockFilter = (medicine: Medicine, stockStatus?: string): boolean => {
  const normalized = normalizeStockStatus(stockStatus);
  if (!normalized) return true;
  if (normalized === "out_of_stock") return medicine.stockQty === 0;
  if (normalized === "low_stock") return medicine.stockQty > 0 && medicine.stockQty <= medicine.reorderLevel;
  return medicine.stockQty > medicine.reorderLevel;
};

const applyExpiryFilter = (medicine: Medicine, expiryStatus?: string): boolean => {
  if (!expiryStatus) return true;
  const now = new Date();
  const normalized = expiryStatus.toLowerCase();
  const numericDays = Number(normalized.replace("within_", ""));
  if (normalized === "expired") return medicine.expiryDate.getTime() < now.getTime();
  if (normalized === "valid") return medicine.expiryDate.getTime() > now.getTime() + 30 * 24 * 60 * 60 * 1000;

  const days = Number.isFinite(numericDays) && numericDays > 0 ? numericDays : normalized === "expiring_soon" ? 30 : null;
  if (!days) return true;

  const upperBound = now.getTime() + days * 24 * 60 * 60 * 1000;
  const expiry = medicine.expiryDate.getTime();
  return expiry >= now.getTime() && expiry <= upperBound;
};

const compareMedicine = (field: "name" | "stockQty" | "expiryDate" | "mrp", direction: "asc" | "desc") => (a: Medicine, b: Medicine): number => {
  const multiplier = direction === "desc" ? -1 : 1;
  if (field === "name") return a.name.localeCompare(b.name) * multiplier;
  if (field === "expiryDate") return (a.expiryDate.getTime() - b.expiryDate.getTime()) * multiplier;
  return (a[field] - b[field]) * multiplier;
};

const baseWhere = (pharmacyId: string, query: InventoryQuery): Prisma.MedicineWhereInput => {
  const where: Prisma.MedicineWhereInput = {
    pharmacyId,
    isActive: true
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { genericName: { contains: query.search, mode: "insensitive" } },
      { manufacturer: { contains: query.search, mode: "insensitive" } },
      { sku: { contains: query.search, mode: "insensitive" } },
      { barcodeId: { contains: query.search, mode: "insensitive" } }
    ];
  }

  if (query.category) {
    const category = normalizeCategory(query.category);
    if (!category) {
      throw new AppError(`Unsupported medicine category: ${query.category}`, 400, ErrorCode.VALIDATION_001);
    }
    where.category = category;
  }

  if (query.manufacturer) {
    where.manufacturer = { contains: query.manufacturer, mode: "insensitive" };
  }

  if (query.isOnline === "true") where.isOnline = true;
  if (query.isOnline === "false") where.isOnline = false;

  return where;
};

const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const headerKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseDateCell = (value: string, column: string): Date => {
  const trimmed = value.trim();
  const ddMmYyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const date = ddMmYyyy
    ? new Date(Date.UTC(Number(ddMmYyyy[3]), Number(ddMmYyyy[2]) - 1, Number(ddMmYyyy[1])))
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${column} must be a valid date`);
  }
  return date;
};

const parseNumberCell = (value: string, column: string): number => {
  const numeric = Number(value.replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(numeric)) {
    throw new Error(`${column} must be a valid number`);
  }
  return numeric;
};

const parseMoneyCell = (value: string, column: string): number => Math.round(parseNumberCell(value, column) * 100);

const csvCell = (value: unknown): string => {
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint"
        ? String(value)
        : value == null
          ? ""
          : JSON.stringify(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

export const inventoryService = {
  async listMedicines(pharmacyId: string, query: InventoryQuery) {
    const { page, limit } = getPaginationParams(query.page, query.limit);
    const medicines = await prisma.medicine.findMany({
      where: baseWhere(pharmacyId, query)
    });

    const filtered = medicines
      .filter((medicine) => applyStockFilter(medicine, query.stockStatus))
      .filter((medicine) => applyExpiryFilter(medicine, query.expiryStatus))
      .sort(compareMedicine(normalizeSortField(query.sort), query.sortDir ?? "asc"));

    const start = (page - 1) * limit;
    return createPagination(filtered.slice(start, start + limit), filtered.length, page, limit);
  },

  async lowStockAlerts(pharmacyId: string): Promise<{
    total: number;
    categories: {
      category: MedicineCategory;
      count: number;
      reorderSuggestionQty: number;
      items: (Medicine & { reorderSuggestionQty: number })[];
    }[];
    medicines: (Medicine & { reorderSuggestionQty: number })[];
  }> {
    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId, isActive: true },
      orderBy: [{ category: "asc" }, { stockQty: "asc" }, { name: "asc" }]
    });

    const lowStock = medicines
      .filter((medicine) => medicine.stockQty <= medicine.reorderLevel)
      .map((medicine) => ({
        ...medicine,
        reorderSuggestionQty: Math.max(medicine.reorderLevel * 2 - medicine.stockQty, medicine.reorderLevel - medicine.stockQty, 1)
      }));

    const grouped = new Map<MedicineCategory, (Medicine & { reorderSuggestionQty: number })[]>();
    for (const medicine of lowStock) {
      grouped.set(medicine.category, [...(grouped.get(medicine.category) ?? []), medicine]);
    }

    return {
      total: lowStock.length,
      categories: Array.from(grouped.entries()).map(([category, items]) => ({
        category,
        count: items.length,
        reorderSuggestionQty: items.reduce((sum, item) => sum + item.reorderSuggestionQty, 0),
        items
      })),
      medicines: lowStock
    };
  },

  async expiryAlerts(pharmacyId: string, days = 30): Promise<{ days: number; total: number; totalMrpAtRisk: number; medicines: Medicine[] }> {
    const normalizedDays = Math.min(365, Math.max(1, Number.isFinite(days) ? days : 30));
    const now = new Date();
    const threshold = new Date(now.getTime() + normalizedDays * 24 * 60 * 60 * 1000);
    const medicines = await prisma.medicine.findMany({
      where: {
        pharmacyId,
        isActive: true,
        expiryDate: {
          gte: now,
          lte: threshold
        }
      },
      orderBy: [{ expiryDate: "asc" }, { name: "asc" }]
    });

    return {
      days: normalizedDays,
      total: medicines.length,
      totalMrpAtRisk: medicines.reduce((sum, medicine) => sum + medicine.mrp * medicine.stockQty, 0),
      medicines
    };
  },

  async bulkImport(pharmacyId: string, csvBuffer: Buffer): Promise<{ inserted: number; skipped: number; errors: BulkImportError[] }> {
    const rows = parseCsv(csvBuffer.toString("utf8").replace(/^\uFEFF/, ""));
    if (rows.length < 2) {
      throw new AppError("CSV must include a header row and at least one data row", 400, ErrorCode.VALIDATION_001);
    }

    const headers = rows[0]?.map(headerKey) ?? [];
    const rowObjects = rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? ""]))
    }));

    const validRows: BulkMedicineInput[] = [];
    const errors: BulkImportError[] = [];

    for (const row of rowObjects) {
      try {
        const category = normalizeCategory(row.values.category ?? "");
        if (!category) throw new Error("category must be one of the supported medicine categories");
        const expiryDate = parseDateCell(row.values.expirydate ?? "", "expiryDate");
        const mfgDate = new Date(expiryDate);
        mfgDate.setFullYear(expiryDate.getFullYear() - 2);
        const sku = row.values.sku || `IMP-${slugify(row.values.name ?? "medicine").slice(0, 12).toUpperCase()}-${row.rowNumber}`;

        const parsed = medicineSchema.parse({
          name: row.values.name,
          genericName: row.values.genericname,
          sku,
          category,
          manufacturer: row.values.manufacturer,
          batchNo: row.values.batchno,
          expiryDate,
          mfgDate,
          mrp: parseMoneyCell(row.values.mrp ?? "", "mrp"),
          purchasePrice: parseMoneyCell(row.values.purchaseprice ?? "", "purchasePrice"),
          gstRate: parseNumberCell(row.values.gstrate ?? "12", "gstRate"),
          hsnCode: row.values.hsncode,
          stockQty: Math.trunc(parseNumberCell(row.values.stockqty ?? "", "stockQty")),
          reorderLevel: Math.trunc(parseNumberCell(row.values.reorderlevel ?? "", "reorderLevel")),
          scheduleType: "GENERAL",
          barcodeId: null,
          isOnline: true,
          onlinePrice: null
        });
        validRows.push({ ...parsed, sku });
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          sku: row.values.sku,
          message: error instanceof Error ? error.message : "Invalid row",
          issues:
            error instanceof z.ZodError
              ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
              : undefined
        });
      }
    }

    let inserted = 0;
    for (const row of validRows) {
      try {
        await prisma.medicine.create({ data: { ...row, pharmacyId } });
        inserted += 1;
      } catch (error) {
        errors.push({
          row: rows.findIndex((csvRow) => csvRow[2] === row.sku) + 1,
          sku: row.sku,
          message:
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
              ? "Duplicate SKU for this pharmacy"
              : error instanceof Error
                ? error.message
                : "Failed to insert row"
        });
      }
    }

    return { inserted, skipped: rows.length - 1 - inserted, errors };
  },

  async exportInventoryCsv(pharmacyId: string): Promise<string> {
    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId },
      orderBy: [{ name: "asc" }, { sku: "asc" }]
    });

    const columns: (keyof Medicine)[] = [
      "id",
      "pharmacyId",
      "name",
      "genericName",
      "sku",
      "category",
      "manufacturer",
      "batchNo",
      "expiryDate",
      "mfgDate",
      "mrp",
      "purchasePrice",
      "gstRate",
      "hsnCode",
      "stockQty",
      "reorderLevel",
      "scheduleType",
      "barcodeId",
      "isOnline",
      "onlinePrice",
      "isActive",
      "createdAt",
      "updatedAt"
    ];

    const header = columns.join(",");
    const body = medicines.map((medicine) => columns.map((column) => csvCell(medicine[column])).join(",")).join("\n");
    return `${header}\n${body}\n`;
  },

  async handleStockDeductionAlerts(pharmacyId: string, medicineIds: string[]): Promise<void> {
    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId, id: { in: Array.from(new Set(medicineIds)) }, isActive: true }
    });
    const lowStock = medicines.filter((medicine) => medicine.stockQty < medicine.reorderLevel);
    if (lowStock.length === 0) return;

    for (const medicine of lowStock) {
      emitToPharmacy(pharmacyId, "stock:low_alert", {
        medicineId: medicine.id,
        name: medicine.name,
        sku: medicine.sku,
        stockQty: medicine.stockQty,
        reorderLevel: medicine.reorderLevel,
        reorderSuggestionQty: Math.max(medicine.reorderLevel * 2 - medicine.stockQty, 1)
      });
    }

    await addQueueJob(reorderAlertQueue, "check", {
      pharmacyId,
      medicineIds: lowStock.map((medicine) => medicine.id)
    });
  }
};
