import { ErrorCode } from "@pharmacy-os/types";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/auth-tokens.js";


export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { staff: true, pharmacy: true }
    });

    if (!user?.pharmacy || !user.staff || !user.pharmacy.isActive) {
      throw new AppError("User session is no longer valid", 401, ErrorCode.AUTH_002);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      pharmacyId: user.pharmacy.id,
      staffRole: user.staff.role,
      plan: user.pharmacy.plan,
      permissions: permissionsForRole(user.staff.role)
    };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError("Invalid or expired token", 401, ErrorCode.AUTH_002));
  }
};

export const permissionsForRole = (role: string): string[] => {
  const all = [
    "dashboard:read",
    "inventory:read",
    "inventory:write",
    "inventory:delete",
    "billing:read",
    "billing:write",
    "billing:delete",
    "orders:read",
    "orders:write",
    "customers:read",
    "customers:write",
    "delivery:read",
    "delivery:write",
    "analytics:read",
    "settings:read",
    "settings:write",
    "team:manage",
    "subscription:manage"
  ];

  if (role === "OWNER") return all;
  if (role === "MANAGER") return all.filter((p) => !["billing:delete", "team:manage", "subscription:manage"].includes(p));
  if (role === "BILLING") return ["billing:read", "billing:write", "inventory:read", "customers:read"];
  if (role === "DELIVERY") return ["delivery:read", "delivery:write", "orders:read"];
  return [];
};
