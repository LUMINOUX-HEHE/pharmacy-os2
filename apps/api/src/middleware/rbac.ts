import { ErrorCode } from "@pharmacy-os/types";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error.js";


export const requirePermission =
  (...permissions: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const granted = req.user?.permissions ?? [];
    const allowed = permissions.every((permission) => granted.includes(permission));
    if (!allowed) {
      next(new AppError("You do not have permission to perform this action", 403, ErrorCode.AUTH_003));
      return;
    }
    next();
  };

export const requireAuthContext = (req: Request): Express.UserContext => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
  }
  return req.user;
};
