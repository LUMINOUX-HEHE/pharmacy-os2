import type { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma.js";


export const audit = async (input: {
  pharmacyId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> => {
  const metadata = input.metadata
    ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
    : undefined;

  await prisma.auditLog.create({
    data: {
      pharmacyId: input.pharmacyId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata,
      ip: input.ip
    }
  });
};
