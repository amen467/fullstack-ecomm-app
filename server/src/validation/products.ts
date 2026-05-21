import { z } from "zod";

const productIdSchema = z.coerce
  .number({ error: "Product id must be a positive integer" })
  .int("Product id must be a positive integer")
  .positive("Product id must be a positive integer");

const optionalTrimmedString = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, schema.optional());

export const productParamsSchema = z.object({
  id: productIdSchema,
});

export const productListQuerySchema = z.object({
  category: optionalTrimmedString(
    z
      .string()
      .max(80, "Category filter is too long")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Category filter must be a valid slug"),
  ),
  search: optionalTrimmedString(
    z
      .string()
      .max(120, "Search query is too long"),
  ),
});

export type ProductParams = z.infer<typeof productParamsSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
