import { z } from "zod";

const orderIdSchema = z.coerce
  .number({ error: "Order id must be a positive integer" })
  .int("Order id must be a positive integer")
  .positive("Order id must be a positive integer");

export const orderParamsSchema = z.object({
  id: orderIdSchema,
});

export type OrderParams = z.infer<typeof orderParamsSchema>;
