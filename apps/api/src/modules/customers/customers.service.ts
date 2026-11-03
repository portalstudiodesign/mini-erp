import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
import { toPage, toSkipTake } from "../../lib/pagination.js";
import type { CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from "./customers.schemas.js";

export async function listCustomers(query: CustomerListQuery) {
  const where: Prisma.CustomerWhereInput = {
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { taxId: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
      ],
    }),
    ...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
      ...toSkipTake(query),
    }),
    prisma.customer.count({ where }),
  ]);
  return toPage(items, total, query);
}

export async function getCustomer(id: number) {
  const [customer, totals] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: "desc" }, take: 10 } },
    }),
    prisma.order.aggregate({
      where: { customerId: id, status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] } },
      _sum: { total: true },
      _count: true,
    }),
  ]);
  if (!customer) throw notFound("Clientul");
  return { ...customer, stats: { orderCount: totals._count, revenue: totals._sum.total ?? 0 } };
}

export function createCustomer(data: CreateCustomerInput) {
  return prisma.customer.create({ data });
}

export function updateCustomer(id: number, data: UpdateCustomerInput) {
  return prisma.customer.update({ where: { id }, data });
}
