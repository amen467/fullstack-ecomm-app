import { z } from "zod";

const emailSchema = z
  .string({ error: "Valid email is required" })
  .trim()
  .toLowerCase()
  .email("Valid email is required");

export const registerSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required"),
  email: emailSchema,
  password: z
    .string({ error: "Password must be at least 8 characters" })
    .min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
