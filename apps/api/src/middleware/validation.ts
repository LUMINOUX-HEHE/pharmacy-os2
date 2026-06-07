import { ErrorCode } from "@pharmacy-os/types";
import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

import { AppError } from "../utils/app-error.js";

export const validate =
  (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new AppError(
          "Validation failed",
          400,
          ErrorCode.VALIDATION_001,
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        )
      );
      return;
    }
    if (source !== "query") {
      req[source] = result.data as Record<string, unknown>;
    }
    next();
  };
