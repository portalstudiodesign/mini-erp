import { z } from "zod";

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional().catch(undefined),
});

export type PageQuery = z.infer<typeof pageQuery>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function toSkipTake({ page, pageSize }: PageQuery) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(items: T[], total: number, { page, pageSize }: PageQuery): Page<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export const idParam = z.coerce.number().int().positive();
