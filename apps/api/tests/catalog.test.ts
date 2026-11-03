import type { Agent } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createProduct, loginAs, resetDb } from "./helpers.js";

let admin: Agent;

beforeEach(async () => {
  await resetDb();
  admin = (await loginAs("ADMIN")).agent;
});

describe("produse", () => {
  it("creează un produs cu SKU normalizat, stoc 0, și respinge SKU duplicat", async () => {
    const res = await admin.post("/api/products").send({ sku: "prt-001", name: "Poartă test", price: 1500.5 }).expect(201);
    expect(res.body).toMatchObject({ sku: "PRT-001", stock: 0, price: "1500.5" });

    const dup = await admin.post("/api/products").send({ sku: "PRT-001", name: "Alt nume", price: 1 }).expect(409);
    expect(dup.body.error.code).toBe("DUPLICATE");
  });

  it("întoarce erorile de validare pe câmpuri", async () => {
    const res = await admin.post("/api/products").send({ sku: "x", name: "", price: -1 }).expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["sku", "name", "price"]));
  });

  it("filtrează produsele sub stocul minim și paginează", async () => {
    await createProduct({ stock: 1, minStock: 5 });
    await createProduct({ stock: 50, minStock: 5 });
    await createProduct({ stock: 0, minStock: 1 });

    const low = await admin.get("/api/products?lowStock=true").expect(200);
    expect(low.body.total).toBe(2);

    const page = await admin.get("/api/products?pageSize=2&page=2").expect(200);
    expect(page.body).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(page.body.items).toHaveLength(1);
  });
});

describe("clienți", () => {
  it("validează CUI-ul și îl normalizează", async () => {
    await admin.post("/api/customers").send({ name: "Firma Test SRL", taxId: "14399841" }).expect(400);

    const res = await admin.post("/api/customers").send({ name: "Firma Test SRL", taxId: "ro 14399840" }).expect(201);
    expect(res.body.taxId).toBe("RO14399840");
  });

  it("caută după nume sau CUI", async () => {
    await admin.post("/api/customers").send({ name: "Alfa Metal SRL", taxId: "RO14399840" }).expect(201);
    await admin.post("/api/customers").send({ name: "Beta Construct SRL" }).expect(201);

    expect((await admin.get("/api/customers?q=alfa")).body.total).toBe(1);
    expect((await admin.get("/api/customers?q=14399")).body.total).toBe(1);
  });
});
