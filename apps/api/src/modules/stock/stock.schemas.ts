import { z } from "zod";
import { idParam, pageQuery } from "../../lib/pagination.js";

// SALE și RETURN apar doar din fluxul comenzilor; manual se pot face doar intrări și corecții.
export const createMovementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("RECEIPT"),
    productId: idParam,
    quantity: z.coerce.number().int().positive("Cantitatea trebuie să fie pozitivă").max(1_000_000),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal("ADJUSTMENT"),
    productId: idParam,
    quantity: z.coerce
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((n) => n !== 0, "Cantitatea nu poate fi 0"),
    reason: z.string().trim().min(3, "Motivul este obligatoriu la corecții").max(300),
  }),
]);

export const movementListQuery = pageQuery.extend({
  productId: idParam.optional(),
  type: z.enum(["RECEIPT", "SALE", "RETURN", "ADJUSTMENT"]).optional(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type MovementListQuery = z.infer<typeof movementListQuery>;
