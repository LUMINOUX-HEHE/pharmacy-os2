import ExcelJS from "exceljs";

import { prisma } from "../config/prisma.js";
import { uploadBufferToCloudinary } from "../utils/cloudinary-upload.js";
import { sendEmail } from "../utils/mailer.js";

import { reportGenerationQueue } from "./queues.js";

interface ReportGenerationJobData {
  reportType?: string;
  report?: string;
  pharmacyId: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  userId?: string;
}

export const registerReportJob = (): void => {
  reportGenerationQueue.process("generate", async (job) => {
    const payload = job.data as ReportGenerationJobData;
    const reportType = payload.reportType ?? payload.report ?? "sales-summary";
    const startDate = payload.dateRange?.startDate
      ? new Date(payload.dateRange.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = payload.dateRange?.endDate ? new Date(payload.dateRange.endDate) : new Date();

    const [pharmacy, user, bills] = await Promise.all([
      prisma.pharmacy.findUnique({ where: { id: payload.pharmacyId } }),
      payload.userId ? prisma.user.findUnique({ where: { id: payload.userId } }) : Promise.resolve(null),
      prisma.bill.findMany({
        where: {
          pharmacyId: payload.pharmacyId,
          status: { not: "VOID" },
          createdAt: { gte: startDate, lte: endDate }
        },
        include: { items: { include: { medicine: true } } },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Pharmacy OS";
    workbook.created = new Date();
    const sales = workbook.addWorksheet("Sales");
    sales.columns = [
      { header: "Bill No", key: "billNo", width: 20 },
      { header: "Date", key: "date", width: 18 },
      { header: "Patient", key: "patient", width: 24 },
      { header: "Payment Mode", key: "paymentMode", width: 16 },
      { header: "Subtotal", key: "subtotal", width: 14 },
      { header: "GST", key: "gst", width: 14 },
      { header: "Discount", key: "discount", width: 14 },
      { header: "Total", key: "total", width: 14 }
    ];
    sales.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sales.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1628" } };

    for (const bill of bills) {
      sales.addRow({
        billNo: bill.billNo,
        date: bill.createdAt,
        patient: bill.patientName ?? "Walk-in customer",
        paymentMode: bill.paymentMode,
        subtotal: bill.subtotal / 100,
        gst: bill.gstAmount / 100,
        discount: bill.discount / 100,
        total: bill.totalAmount / 100
      });
    }
    sales.getColumn("date").numFmt = "dd-mmm-yyyy";
    for (const key of ["subtotal", "gst", "discount", "total"]) {
      sales.getColumn(key).numFmt = '"Rs." #,##0.00';
    }

    const summary = workbook.addWorksheet("Summary");
    summary.addRows([
      ["Report", reportType],
      ["Pharmacy", pharmacy?.name ?? payload.pharmacyId],
      ["Start Date", startDate],
      ["End Date", endDate],
      ["Bills", bills.length],
      ["Revenue", bills.reduce((sum, bill) => sum + bill.totalAmount, 0) / 100],
      ["Generated At", new Date()]
    ]);
    summary.getColumn(1).font = { bold: true };
    summary.getColumn(2).width = 28;
    summary.getCell("B6").numFmt = '"Rs." #,##0.00';

    const workbookBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
    const url = await uploadBufferToCloudinary({
      buffer,
      originalname: `${reportType}-${job.id}.xlsx`,
      folder: `pharmacy-os/reports/${payload.pharmacyId}`,
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const notification = await prisma.notification.create({
      data: {
        pharmacyId: payload.pharmacyId,
        userId: payload.userId,
        type: "SYSTEM",
        title: "Report ready",
        message: `${reportType} Excel export is ready.`,
        metadata: { url }
      }
    });

    if (user) {
      await sendEmail({
        to: user.email,
        subject: "Your Pharmacy OS report is ready",
        html: `<p>Your ${reportType} report is ready.</p><p><a href="${url}">Download report</a></p>`,
        text: `Your ${reportType} report is ready: ${url}`
      });
    }

    return { notificationId: notification.id, downloadUrl: url };
  });
};
