import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { app, createUser, loginAs, PASSWORD, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("autentificare", () => {
  it("login setează un cookie httpOnly și întoarce permisiunile rolului", async () => {
    const user = await createUser("SALES");
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD }).expect(200);

    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=.+HttpOnly/i);
    expect(res.body.user).toMatchObject({ email: user.email, role: "SALES" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.permissions).toContain("orders:create");
    expect(res.body.permissions).not.toContain("users:manage");
  });

  it("parola greșită și emailul inexistent dau același răspuns", async () => {
    const user = await createUser("SALES");
    const wrong = await request(app).post("/api/auth/login").send({ email: user.email, password: "gresit" });
    const missing = await request(app).post("/api/auth/login").send({ email: "nu@exista.ro", password: "gresit" });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it("rutele protejate cer autentificare", async () => {
    await request(app).get("/api/products").expect(401);
  });

  it("un cont dezactivat pierde accesul imediat, chiar cu token valid", async () => {
    const { agent, user } = await loginAs("SALES");
    await agent.get("/api/auth/me").expect(200);

    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    await agent.get("/api/auth/me").expect(401);
  });

  it("logout șterge sesiunea", async () => {
    const { agent } = await loginAs("ADMIN");
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });
});

describe("autorizare pe roluri", () => {
  it("depozitul nu poate crea comenzi, vânzările nu pot crea produse", async () => {
    const warehouse = await loginAs("WAREHOUSE");
    await warehouse.agent.post("/api/orders").send({ customerId: 1, items: [{ productId: 1, quantity: 1 }] }).expect(403);

    await prisma.user.deleteMany();
    const sales = await loginAs("SALES");
    await sales.agent.post("/api/products").send({ sku: "ABC-1", name: "Test", price: 1 }).expect(403);
  });

  it("doar adminul gestionează utilizatori", async () => {
    const { agent } = await loginAs("SALES");
    await agent.get("/api/users").expect(403);
  });
});
