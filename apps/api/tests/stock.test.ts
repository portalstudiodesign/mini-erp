import type { Agent } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { checkLowStock } from "../src/jobs/lowStock.js";
import { createCustomer, createProduct, loginAs, productStock, resetDb } from "./helpers.js";

let warehouse: Agent;

beforeEach(async () => {
  await resetDb();
  warehouse = (await loginAs("WAREHOUSE")).agent;
});

describe("mișcări de stoc", () => {
  it("recepția crește stocul", async () => {
    const p = await createProduct({ stock: 2 });
    await warehouse.post("/api/stock/movements").send({ type: "RECEIPT", productId: p.id, quantity: 8 }).expect(201);
    expect(await productStock(p.id)).toBe(10);
  });

  it("corecția cere motiv și nu poate duce stocul pe minus", async () => {
    const p = await createProduct({ stock: 5 });

    await warehouse.post("/api/stock/movements").send({ type: "ADJUSTMENT", productId: p.id, quantity: -2 }).expect(400);
    await warehouse
      .post("/api/stock/movements")
      .send({ type: "ADJUSTMENT", productId: p.id, quantity: -6, reason: "Inventar" })
      .expect(409);
    await warehouse
      .post("/api/stock/movements")
      .send({ type: "ADJUSTMENT", productId: p.id, quantity: -2, reason: "Inventar" })
      .expect(201);

    expect(await productStock(p.id)).toBe(3);
  });

  it("SALE nu se poate introduce manual", async () => {
    const p = await createProduct();
    await warehouse.post("/api/stock/movements").send({ type: "SALE", productId: p.id, quantity: -1 }).expect(400);
  });

  it("stocul nu se poate modifica prin editarea produsului", async () => {
    const { agent: admin } = await loginAs("ADMIN");
    const p = await createProduct({ stock: 5 });
    await admin.patch(`/api/products/${p.id}`).send({ stock: 999, name: "Nume nou" }).expect(200);
    expect(await productStock(p.id)).toBe(5);
  });
});

describe("alerte de stoc minim", () => {
  it("se deschid la confirmarea unei comenzi și se închid la reaprovizionare", async () => {
    const p = await createProduct({ stock: 5, minStock: 3 });
    const { agent: sales } = await loginAs("SALES");
    const customer = await createCustomer();

    const order = await sales
      .post("/api/orders")
      .send({ customerId: customer.id, items: [{ productId: p.id, quantity: 4 }] })
      .expect(201);
    await sales.post(`/api/orders/${order.body.id}/status`).send({ status: "CONFIRMED" }).expect(200);

    const open = await warehouse.get("/api/stock/alerts").expect(200);
    expect(open.body).toMatchObject([{ productId: p.id, stock: 1, minStock: 3 }]);

    await warehouse.post("/api/stock/movements").send({ type: "RECEIPT", productId: p.id, quantity: 10 }).expect(201);
    expect((await warehouse.get("/api/stock/alerts")).body).toEqual([]);
  });

  it("jobul e idempotent: nu dublează alertele", async () => {
    await createProduct({ stock: 1, minStock: 5 });
    await checkLowStock("all");
    await checkLowStock("all");
    expect(await prisma.stockAlert.count()).toBe(1);
  });

  it("nu dublează alertele nici când jobul rulează în paralel", async () => {
    const p = await createProduct({ stock: 1, minStock: 5 });
    await Promise.all(Array.from({ length: 5 }, () => checkLowStock([p.id])));
    expect(await prisma.stockAlert.count({ where: { resolvedAt: null } })).toBe(1);
  });

  it("după rezolvare se poate deschide o alertă nouă pentru același produs", async () => {
    const { agent: admin } = await loginAs("ADMIN");
    const p = await createProduct({ stock: 1, minStock: 5 });
    await checkLowStock([p.id]);

    await warehouse.post("/api/stock/movements").send({ type: "RECEIPT", productId: p.id, quantity: 10 }).expect(201);
    await warehouse
      .post("/api/stock/movements")
      .send({ type: "ADJUSTMENT", productId: p.id, quantity: -8, reason: "Inventar" })
      .expect(201);

    expect((await admin.get("/api/stock/alerts")).body).toHaveLength(1);
    expect(await prisma.stockAlert.count()).toBe(2);
  });
});
