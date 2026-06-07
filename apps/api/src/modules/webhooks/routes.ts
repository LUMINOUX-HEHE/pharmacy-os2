import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: Razorpay and Twilio webhook callbacks.
 */

import { handleRazorpayWebhook, handleWhatsAppWebhook } from "./webhooks.controller.js";

export const webhooksRouter = Router();

webhooksRouter.post("/razorpay", handleRazorpayWebhook);
webhooksRouter.post("/whatsapp", handleWhatsAppWebhook);
