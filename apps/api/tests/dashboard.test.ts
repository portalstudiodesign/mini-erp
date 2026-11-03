import { beforeEach, describe, expect, it } from "vitest";
import { createCustomer, createProduct, loginAs, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("panou", () => {
  it("include comenzile confirmate azi în graficul pe zile", async () => {
    const { agent } = await loginAs("SALES");
    const customer = await createCustomer();
    const product = await createProduct({ price: 250 });

    const order = await agent
      .post("/api/orders")
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 2 }] })
      .expect(201);
    await agent.post(`/api/orders/${order.body.id}/status`).send({ status: "CONFIRMED" }).expect(200);

    const res = await agent.get("/api/dashboard").expect(200);
    const today = res.body.revenueByDay.at(-1);
    expect(today).toEqual({ date: new Date().toISOString().slice(0, 10), total: 500, orders: 1 });
    expect(res.body.ordersByStatus).toEqual({ CONFIRMED: 1 });
  });
});
