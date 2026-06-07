import nodemailer from "nodemailer";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const sendEmail = async (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_PORT) {
    logger.info("Email captured in development mode", { to: input.to, subject: input.subject });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: `"Pharmacy OS" <${env.SMTP_USER}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text
  });
};
