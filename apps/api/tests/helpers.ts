import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { Role } from "../src/generated/prisma/enums.js";

export const app = createApp();
export const PASSWORD = "Test1234!";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "StockAlert", "StockMovement", "OrderItem", "Order", "Product", "Customer", "User" RESTART IDENTITY CASCADE`,
  );
}

const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function createUser(role: Role, email = `${role.toLowerCase()}@test.ro`) {
  return prisma.user.create({ data: { email, name: `Test ${role}`, role, passwordHash } });
}

/** Un agent supertest care păstrează cookie-ul de sesiune între requesturi. */
export async function loginAs(role: Role) {
  const user = await createUser(role);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: user.email, password: PASSWORD }).expect(200);
  return { agent, user };
}

let skuCounter = 0;
export function createProduct(data: { stock?: number; minStock?: number; price?: number; active?: boolean } = {}) {
  skuCounter++;
  return prisma.product.create({
    data: {
      sku: `TST-${skuCounter.toString().padStart(4, "0")}`,
      name: `Produs test ${skuCounter}`,
      price: data.price ?? 100,
      stock: data.stock ?? 10,
      minStock: data.minStock ?? 0,
      active: data.active ?? true,
    },
  });
}

export function createCustomer(name = "Client Test SRL") {
  return prisma.customer.create({ data: { name } });
}

export function productStock(id: number) {
  return prisma.product.findUniqueOrThrow({ where: { id } }).then((p) => p.stock);
}
