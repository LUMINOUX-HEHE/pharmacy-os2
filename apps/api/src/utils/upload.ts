import { ErrorCode } from "@pharmacy-os/types";
import multer from "multer";

import { AppError } from "./app-error.js";


const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel"
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError("Only JPG, PNG, WEBP and PDF uploads are allowed", 400, ErrorCode.VALIDATION_001));
      return;
    }
    callback(null, true);
  }
});

export const assertSafeUpload = (file: Express.Multer.File): void => {
  const suspiciousNames = [".exe", ".bat", ".cmd", ".scr", ".ps1"];
  if (suspiciousNames.some((suffix) => file.originalname.toLowerCase().endsWith(suffix))) {
    throw new AppError("Unsafe file extension rejected", 400, ErrorCode.VALIDATION_001);
  }
};
