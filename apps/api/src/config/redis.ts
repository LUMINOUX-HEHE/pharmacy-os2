import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000))
});

redis.on("error", (error: Error) => {
  logger.warn("Redis connection issue", { message: error.message });
});

export const cacheKeys = {
  refreshToken: (userId: string) => `refresh:${userId}`,
  legacyRefreshTokenPrefix: (userId: string) => `auth:refresh:${userId}:`,
  otp: (phone: string) => `otp:${phone}`,
  teamInvite: (token: string) => `invite:${token}`,
  notificationSettings: (pharmacyId: string) => `settings:notifications:${pharmacyId}`,
  rateLimit: (key: string) => `rate:${key}`,
  lastExpiryAlert: (pharmacyId: string, bucket: string) => `alerts:expiry:${pharmacyId}:${bucket}`
} as const;
