import type { PharmacyPlan, StaffRole, UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      email: string;
      role: UserRole;
      pharmacyId: string;
      staffRole: StaffRole;
      plan: PharmacyPlan;
      permissions: string[];
    }

    interface Request {
      user?: UserContext;
      requestId?: string;
    }
  }
}

export {};
