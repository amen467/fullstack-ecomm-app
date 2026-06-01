import { z } from "zod";

const productIdSchema = z.coerce
  .number({ error: "Product id must be a positive integer" })
  .int("Product id must be a positive integer")
  .positive("Product id must be a positive integer");

const categoryIdSchema = z
  .number({ error: "Category id must be a positive integer" })
  .int("Category id must be a positive integer")
  .positive("Category id must be a positive integer");

const inventoryCountSchema = z
  .number({ error: "Inventory count must be a non-negative integer" })
  .int("Inventory count must be a non-negative integer")
  .nonnegative("Inventory count must be a non-negative integer");

const priceSchema = z.preprocess((value) => {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}, z
  .string({ error: "Price must be a positive number" })
  .regex(/^\d+(?:\.\d+)?$/, "Price must be a positive number")
  .refine((value) => Number(value) > 0, "Price must be a positive number"));

const requiredTrimmedString = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

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

export const createProductSchema = z.object({
  name: requiredTrimmedString("Product name is required"),
  description: requiredTrimmedString("Product description is required"),
  price: priceSchema,
  imageUrl: requiredTrimmedString("Product image URL is required"),
  inventoryCount: inventoryCountSchema,
  categoryId: categoryIdSchema,
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one product field is required");

export type ProductParams = z.infer<typeof productParamsSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductSchema>;
export type UpdateProductBody = z.infer<typeof updateProductSchema>;
