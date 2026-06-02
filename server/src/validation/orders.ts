import { z } from "zod";
import { OrderStatus } from "../generated/enums.js";

const orderIdSchema = z.coerce
  .number({ error: "Order id must be a positive integer" })
  .int("Order id must be a positive integer")
  .positive("Order id must be a positive integer");

const requiredTrimmedString = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message);

const zipCodeSchema = requiredTrimmedString("ZIP code is required")
  .regex(/^\d{5}$/, "ZIP code must be 5 digits");

const cardNumberSchema = requiredTrimmedString("Card number is required")
  .refine((value) => /^\d[\d ]*\d$|^\d$/.test(value), "Card number can only contain digits and spaces")
  .refine((value) => {
    const digits = value.replaceAll(" ", "");

    return digits.length >= 13 && digits.length <= 19;
  }, "Card number must contain 13 to 19 digits");

const expirySchema = requiredTrimmedString("Expiry is required")
  .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiry must use MM/YY format");

const cvcSchema = requiredTrimmedString("CVC is required")
  .regex(/^\d{3,4}$/, "CVC must be 3 or 4 digits");

export const orderParamsSchema = z.object({
  id: orderIdSchema,
});

export const createOrderSchema = z.object({
  shipping: z.object({
    fullName: requiredTrimmedString("Full name is required"),
    address: requiredTrimmedString("Address is required"),
    city: requiredTrimmedString("City is required"),
    zipCode: zipCodeSchema,
  }),
  payment: z.object({
    cardNumber: cardNumberSchema,
    expiry: expirySchema,
    cvc: cvcSchema,
  }),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus, { error: "Order status must be PENDING, COMPLETED, or SHIPPED" }),
});

export type OrderParams = z.infer<typeof orderParamsSchema>;
export type CreateOrderBody = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusSchema>;
