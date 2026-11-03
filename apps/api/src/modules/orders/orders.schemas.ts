import { z } from "zod";
import { idParam, pageQuery } from "../../lib/pagination.js";

const orderStatus = z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]);

export const createOrderSchema = z.object({
  customerId: idParam,
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: idParam,
        quantity: z.coerce.number().int().positive("Cantitatea trebuie să fie pozitivă").max(100_000),
      }),
    )
    .min(1, "Comanda trebuie să conțină cel puțin un produs")
    .max(100),
});

export const changeStatusSchema = z.object({
  status: orderStatus.exclude(["PENDING"]),
});

export const orderListQuery = pageQuery.extend({
  status: orderStatus.optional(),
  customerId: idParam.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderListQuery = z.infer<typeof orderListQuery>;
