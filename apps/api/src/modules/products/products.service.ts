import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
import { toPage, toSkipTake } from "../../lib/pagination.js";
import type { CreateProductInput, ProductListQuery, UpdateProductInput } from "./products.schemas.js";

export async function listProducts(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { sku: { contains: query.q, mode: "insensitive" } },
      ],
    }),
    ...(query.active !== undefined && { active: query.active }),
    // Comparație între două coloane ale aceluiași rând, făcută în SQL, nu în memorie.
    ...(query.lowStock && { stock: { lt: prisma.product.fields.minStock } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortDir },
      ...toSkipTake(query),
    }),
    prisma.product.count({ where }),
  ]);
  return toPage(items, total, query);
}

export async function getProduct(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
      alerts: { where: { resolvedAt: null } },
    },
  });
  if (!product) throw notFound("Produsul");
  return product;
}

export function createProduct(data: CreateProductInput) {
  return prisma.product.create({ data });
}

export function updateProduct(id: number, data: UpdateProductInput) {
  return prisma.product.update({ where: { id }, data });
}
