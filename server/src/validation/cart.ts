import { z } from "zod";

const cartItemIdSchema = z.coerce
  .number({ error: "Cart item id must be a positive integer" })
  .int("Cart item id must be a positive integer")
  .positive("Cart item id must be a positive integer");

const productIdSchema = z
  .number({ error: "Product id must be a positive integer" })
  .int("Product id must be a positive integer")
  .positive("Product id must be a positive integer");

const quantitySchema = z
  .number({ error: "Quantity must be a positive integer" })
  .int("Quantity must be a positive integer")
  .positive("Quantity must be a positive integer");

export const cartItemParamsSchema = z.object({
  id: cartItemIdSchema,
});

export const addCartItemSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
});

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export type CartItemParams = z.infer<typeof cartItemParamsSchema>;
export type AddCartItemBody = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemSchema>;
