import { z } from "zod";

const productIdSchema = z.coerce
  .number({ error: "Product id must be a positive integer" })
  .int("Product id must be a positive integer")
  .positive("Product id must be a positive integer");

export const productParamsSchema = z.object({
  id: productIdSchema,
});

export type ProductParams = z.infer<typeof productParamsSchema>;
