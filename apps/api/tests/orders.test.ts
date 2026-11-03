import type { Agent } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { createCustomer, createProduct, loginAs, productStock, resetDb } from "./helpers.js";

let sales: Agent;
let customerId: number;

beforeEach(async () => {
  await resetDb();
  sales = (await loginAs("SALES")).agent;
  customerId = (await createCustomer()).id;
});

async function placeOrder(items: { productId: number; quantity: number }[]) {
  const res = await sales.post("/api/orders").send({ customerId, items }).expect(201);
  return res.body as { id: number; total: string; status: string; items: { productId: number; quantity: number }[] };
}

describe("creare comandă", () => {
  it("calculează totalul din prețurile din DB și ignoră prețul trimis de client", async () => {
    const a = await createProduct({ price: 19.99 });
    const b = await createProduct({ price: 250 });

    const res = await sales
      .post("/api/orders")
      .send({ customerId, items: [{ productId: a.id, quantity: 3, unitPrice: 0.01 }, { productId: b.id, quantity: 2 }] })
      .expect(201);

    expect(res.body.status).toBe("PENDING");
    expect(Number(res.body.total)).toBe(559.97);
  });

  it("unește rândurile cu același produs", async () => {
    const p = await createProduct();
    const order = await placeOrder([{ productId: p.id, quantity: 2 }, { productId: p.id, quantity: 3 }]);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(5);
  });

  it("nu modifică stocul cât timp comanda e în așteptare", async () => {
    const p = await createProduct({ stock: 10 });
    await placeOrder([{ productId: p.id, quantity: 4 }]);
    expect(await productStock(p.id)).toBe(10);
  });

  it("respinge produse inactive și liste goale", async () => {
    const inactive = await createProduct({ active: false });
    await sales.post("/api/orders").send({ customerId, items: [{ productId: inactive.id, quantity: 1 }] }).expect(400);

    const res = await sales.post("/api/orders").send({ customerId, items: [] }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("statusul comenzii și stocul", () => {
  it("confirmarea scade stocul și scrie mișcarea în jurnal", async () => {
    const p = await createProduct({ stock: 10 });
    const order = await placeOrder([{ productId: p.id, quantity: 4 }]);

    await sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }).expect(200);

    expect(await productStock(p.id)).toBe(6);
    const movements = await prisma.stockMovement.findMany({ where: { orderId: order.id } });
    expect(movements).toMatchObject([{ productId: p.id, type: "SALE", quantity: -4 }]);
  });

  it("stocul insuficient anulează toată tranzacția", async () => {
    const ok = await createProduct({ stock: 10 });
    const scarce = await createProduct({ stock: 1 });
    const order = await placeOrder([{ productId: ok.id, quantity: 5 }, { productId: scarce.id, quantity: 2 }]);

    const res = await sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }).expect(409);

    expect(res.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", details: { available: 1, requested: 2 } });
    expect(await productStock(ok.id)).toBe(10); // nici primul produs nu a fost scăzut
    expect(await productStock(scarce.id)).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("anularea unei comenzi confirmate readuce stocul", async () => {
    const p = await createProduct({ stock: 10 });
    const order = await placeOrder([{ productId: p.id, quantity: 4 }]);
    await sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }).expect(200);
    await sales.post(`/api/orders/${order.id}/status`).send({ status: "CANCELLED" }).expect(200);

    expect(await productStock(p.id)).toBe(10);
    const types = (await prisma.stockMovement.findMany({ orderBy: { id: "asc" } })).map((m) => m.type);
    expect(types).toEqual(["SALE", "RETURN"]);
  });

  it("respinge tranzițiile invalide", async () => {
    const p = await createProduct();
    const order = await placeOrder([{ productId: p.id, quantity: 1 }]);
    const res = await sales.post(`/api/orders/${order.id}/status`).send({ status: "DELIVERED" }).expect(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("verifică permisiunea pe fiecare tranziție", async () => {
    const p = await createProduct();
    const order = await placeOrder([{ productId: p.id, quantity: 1 }]);
    const { agent: warehouse } = await loginAs("WAREHOUSE");

    await warehouse.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }).expect(403);
    await sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }).expect(200);
    await warehouse.post(`/api/orders/${order.id}/status`).send({ status: "SHIPPED" }).expect(200);
  });

  it("două confirmări simultane pe ultimele bucăți: doar una reușește", async () => {
    const p = await createProduct({ stock: 3 });
    const first = await placeOrder([{ productId: p.id, quantity: 2 }]);
    const second = await placeOrder([{ productId: p.id, quantity: 2 }]);

    const results = await Promise.all([
      sales.post(`/api/orders/${first.id}/status`).send({ status: "CONFIRMED" }),
      sales.post(`/api/orders/${second.id}/status`).send({ status: "CONFIRMED" }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await productStock(p.id)).toBe(1);
  });

  it("aceeași comandă confirmată de două ori simultan scade stocul o singură dată", async () => {
    const p = await createProduct({ stock: 10 });
    const order = await placeOrder([{ productId: p.id, quantity: 3 }]);

    const results = await Promise.all([
      sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }),
      sales.post(`/api/orders/${order.id}/status`).send({ status: "CONFIRMED" }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await productStock(p.id)).toBe(7);
  });
});

describe("listare comenzi", () => {
  it("filtrează după status și caută după numărul comenzii", async () => {
    const p = await createProduct();
    const a = await placeOrder([{ productId: p.id, quantity: 1 }]);
    await placeOrder([{ productId: p.id, quantity: 1 }]);
    await sales.post(`/api/orders/${a.id}/status`).send({ status: "CONFIRMED" }).expect(200);

    const confirmed = await sales.get("/api/orders?status=CONFIRMED").expect(200);
    expect(confirmed.body.total).toBe(1);

    const byId = await sales.get(`/api/orders?q=${a.id}`).expect(200);
    expect(byId.body.items.map((o: { id: number }) => o.id)).toEqual([a.id]);
  });
});
