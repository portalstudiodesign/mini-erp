import { z } from "zod";
import { pageQuery } from "../../lib/pagination.js";

const money = z.coerce.number().nonnegative().multipleOf(0.01, "Maxim două zecimale").max(9_999_999_999);

export const createProductSchema = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, "SKU: 3-30 caractere, litere mari, cifre și -"),
  name: z.string().trim().min(2).max(200),
  unit: z.string().trim().min(1).max(10).default("buc"),
  price: money,
  minStock: z.coerce.number().int().min(0).default(0),
});

// Stocul nu se poate edita direct: se modifică doar prin mișcări de stoc, ca să rămână auditabil.
export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});

export const productListQuery = pageQuery.extend({
  lowStock: z.stringbool().optional(),
  active: z.stringbool().optional(),
  sortBy: z.enum(["name", "sku", "price", "stock", "updatedAt"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuery>;
