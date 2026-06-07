import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Registration, login, phone OTP, refresh-token rotation, logout, and current session endpoints.
 */


import { isProduction } from "../../config/env.js";
import { authenticate } from "../../middleware/auth.js";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";

import { authService } from "./auth.service.js";
import {
  completeProfileSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyPhoneSchema
} from "./schemas.js";

export const authRouter = Router();

const refreshCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const user = await authService.register(input);
      sendSuccess(res, user, "Account created. Verification email sent.", 201);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post("/verify-phone", authRateLimiter, validate(verifyPhoneSchema), async (req, res, next) => {
  try {
    const input = verifyPhoneSchema.parse(req.body);
    const result = await authService.verifyPhone(input);
    sendSuccess(res, result, result.verified ? "Phone verified" : "OTP sent");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/complete-profile", validate(completeProfileSchema), async (req, res, next) => {
  try {
    const input = completeProfileSchema.parse(req.body);
    const pharmacy = await authService.completeProfile(input);
    sendSuccess(res, pharmacy, "Pharmacy profile completed", 201);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const session = await authService.login(input);
    const { refreshToken, ...responseSession } = session;
    res.cookie("refreshToken", refreshToken, refreshCookie);

    sendSuccess(res, responseSession, "Logged in");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = typeof req.cookies.refreshToken === "string" ? req.cookies.refreshToken : undefined;
    if (!token) {
      throw new AppError("Refresh token missing", 401, ErrorCode.AUTH_002);
    }

    const { accessToken, refreshToken } = await authService.refresh(token);
    res.cookie("refreshToken", refreshToken, refreshCookie);
    sendSuccess(res, { accessToken }, "Token refreshed");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = typeof req.cookies.refreshToken === "string" ? req.cookies.refreshToken : undefined;
    await authService.logout(token);
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    sendSuccess(res, { loggedOut: true }, "Logged out");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(input);
    sendSuccess(res, { sent: true }, "If this email exists, a reset link has been sent.");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input);
    sendSuccess(res, { reset: true }, "Password updated");
  } catch (error) {
    next(error);
  }
});

authRouter.get("/reset-password/validate/:token", authRateLimiter, async (req, res, next) => {
  try {
    const token = String(req.params.token ?? "");
    await authService.validateResetToken(token);
    sendSuccess(res, { valid: true }, "Reset token valid");
  } catch (error) {
    next(error);
  }
});

authRouter.get("/verify-email/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    await authService.verifyEmail(token);
    sendSuccess(res, { verified: true }, "Email verified");
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const session = await authService.me(userId);
    sendSuccess(res, session, "Current session");
  } catch (error) {
    next(error);
  }
});
