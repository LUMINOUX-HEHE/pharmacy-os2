import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  pharmacyName: z.string().min(2, "Enter pharmacy name"),
  city: z.string().min(2, "Enter city"),
  message: z.string().min(10, "Tell us what you need")
});
