import twilio from "twilio";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const sendWhatsApp = async (input: { to: string; body: string }): Promise<{ providerId: string }> => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    logger.info("WhatsApp captured in development mode", { to: input.to, body: input.body });
    return { providerId: `dev-${Date.now()}` };
  }

  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const message = await client.messages.create({
    from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${input.to}`,
    body: input.body
  });

  return { providerId: message.sid };
};
