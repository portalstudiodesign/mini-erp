import { z } from "zod";
import { isValidCui, normalizeCui } from "../../lib/cui.js";
import { pageQuery } from "../../lib/pagination.js";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null).nullish();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  taxId: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeCui(v) : null))
    .refine((v) => v === null || isValidCui(v), "CUI invalid")
    .nullish(),
  email: z.email().trim().toLowerCase().or(z.literal("").transform(() => null)).nullish(),
  phone: optionalText(30),
  city: optionalText(100),
  address: optionalText(300),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListQuery = pageQuery.extend({
  city: z.string().trim().min(1).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuery>;
