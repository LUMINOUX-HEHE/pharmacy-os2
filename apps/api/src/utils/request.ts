import { ErrorCode } from "@pharmacy-os/types";
import type { Request } from "express";

import { AppError } from "./app-error.js";


export const routeParam = (req: Request, name: string): string => {
  const value = req.params[name];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new AppError(`Route parameter '${name}' is required`, 400, ErrorCode.VALIDATION_001);
};
