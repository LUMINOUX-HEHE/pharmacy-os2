import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Uploads
 *     description: File upload and management endpoints.
 */

import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";

import { uploadsService } from "./uploads.service.js";

export const uploadsRouter = Router();

uploadsRouter.use(authenticate);

uploadsRouter.post("/", async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("No file provided", 400, ErrorCode.VALIDATION_001);
    }
    const result = await uploadsService.uploadFile(req.file);
    sendSuccess(res, result, "File uploaded successfully", 201);
  } catch (error) {
    next(error);
  }
});
