import rateLimit from "express-rate-limit";

import { isProduction } from "../config/env.js";

const isLocalDevelopmentRequest = (ip?: string): boolean =>
  !isProduction && ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(ip ?? "");

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skip: (req) => isLocalDevelopmentRequest(req.ip),
  standardHeaders: "draft-8",
  legacyHeaders: false
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100, // Temporarily increased for dev
  skip: (req) => isLocalDevelopmentRequest(req.ip),
  standardHeaders: "draft-8",
  legacyHeaders: false
});
