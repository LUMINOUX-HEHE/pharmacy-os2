import { ErrorCode } from "@pharmacy-os/types";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";


import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";


export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, ErrorCode.SYSTEM_001));
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      data: null,
      message: error.message,
      code: error.code,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        issues: error.issues
      }
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      message: "Validation failed",
      code: ErrorCode.VALIDATION_001,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      }
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = error.code === "P2025" ? 404 : 409;
    
    let message = "Database constraint failed";
    if (error.code === "P2025") message = "Record not found";
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(",") || "field";
      message = `This ${target} is already in use. Please use a different one.`;
    }

    return res.status(statusCode).json({
      success: false,
      data: null,
      message: message,
      code: ErrorCode.SYSTEM_001,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    });
  }

  const message = error instanceof Error ? error.message : "Unknown system error";
  logger.error("Unhandled API error", { message, error, requestId: req.requestId });
  return res.status(500).json({
    success: false,
    data: null,
    message: "Internal server error",
    code: ErrorCode.SYSTEM_001,
    meta: {
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    }
  });
};
