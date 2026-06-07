import crypto from "node:crypto";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { env, isTest } from "../config/env.js";
import { cacheKeys, redis } from "../config/redis.js";

export interface AccessTokenPayload {
  sub: string;
  pharmacyId: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

const localRefreshTokens = new Map<string, { hash: string; expiresAt: number }>();
const refreshTokenTtlSeconds = 7 * 24 * 60 * 60;
const refreshTokenTtlMs = refreshTokenTtlSeconds * 1000;

const canUseRedis = async (): Promise<boolean> => {
  if (isTest) return false;
  if (redis.status === "ready") return true;
  if (redis.status !== "wait" && redis.status !== "end") return false;

  try {
    await redis.connect();
    return String(redis.status) === "ready";
  } catch {
    return false;
  }
};

const decodeRefreshPayload = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded !== "object" || !("sub" in decoded) || !("tokenId" in decoded)) {
    throw new Error("Invalid refresh token");
  }
  return decoded as unknown as RefreshTokenPayload;
};

const getRefreshHash = async (userId: string): Promise<string | null> => {
  const key = cacheKeys.refreshToken(userId);
  if (await canUseRedis()) {
    return redis.get(key);
  }

  const local = localRefreshTokens.get(key);
  if (!local) return null;
  if (local.expiresAt <= Date.now()) {
    localRefreshTokens.delete(key);
    return null;
  }
  return local.hash;
};

const storeRefreshHash = async (userId: string, hash: string): Promise<void> => {
  const key = cacheKeys.refreshToken(userId);
  if (await canUseRedis()) {
    await redis.set(key, hash, "EX", refreshTokenTtlSeconds);
    return;
  }

  localRefreshTokens.set(key, { hash, expiresAt: Date.now() + refreshTokenTtlMs });
};

export const revokeAllRefreshTokens = async (userId: string): Promise<void> => {
  const key = cacheKeys.refreshToken(userId);
  const legacyPrefix = cacheKeys.legacyRefreshTokenPrefix(userId);
  localRefreshTokens.delete(key);
  for (const localKey of Array.from(localRefreshTokens.keys())) {
    if (localKey.startsWith(legacyPrefix)) {
      localRefreshTokens.delete(localKey);
    }
  }

  if (!(await canUseRedis())) return;

  await redis.del(key);
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${legacyPrefix}*`, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
};

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });

export const signRefreshToken = async (userId: string): Promise<{ refreshToken: string; tokenId: string }> => {
  const tokenId = crypto.randomUUID();
  const refreshToken = jwt.sign({ sub: userId, tokenId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  const hash = await bcrypt.hash(refreshToken, 12);
  await storeRefreshHash(userId, hash);
  return { refreshToken, tokenId };
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || !("sub" in decoded) || !("pharmacyId" in decoded) || !("role" in decoded)) {
    throw new Error("Invalid access token");
  }
  return decoded as unknown as AccessTokenPayload;
};

export const verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
  const payload = decodeRefreshPayload(token);
  const stored = await getRefreshHash(payload.sub);
  if (!stored) {
    await revokeAllRefreshTokens(payload.sub);
    throw new Error("Refresh token has been revoked");
  }

  const valid = await bcrypt.compare(token, stored);
  if (!valid) {
    await revokeAllRefreshTokens(payload.sub);
    throw new Error("Refresh token reuse detected");
  }

  await revokeAllRefreshTokens(payload.sub);
  return payload;
};

export const revokeRefreshToken = async (userId: string, _tokenId?: string): Promise<void> => {
  await revokeAllRefreshTokens(userId);
};

export const revokeRefreshTokenFromToken = async (token: string): Promise<void> => {
  try {
    const payload = decodeRefreshPayload(token);
    await revokeAllRefreshTokens(payload.sub);
  } catch {
    // Logout should be idempotent; an invalid/expired token simply has nothing to revoke.
  }
};

export const hashOpaqueToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");
