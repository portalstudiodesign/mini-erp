import { describe, expect, it } from "vitest";
import { allowedTransitions, stockEffect, transitionPermission } from "../../src/modules/orders/orders.workflow.js";

describe("fluxul comenzilor", () => {
  it("vânzările confirmă și anulează, depozitul expediază", () => {
    expect(allowedTransitions("PENDING", "SALES")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(allowedTransitions("PENDING", "WAREHOUSE")).toEqual([]);
    expect(allowedTransitions("CONFIRMED", "WAREHOUSE")).toEqual(["SHIPPED"]);
    expect(allowedTransitions("CONFIRMED", "ADMIN")).toEqual(["SHIPPED", "CANCELLED"]);
  });

  it("stările finale nu mai au tranziții", () => {
    expect(allowedTransitions("DELIVERED", "ADMIN")).toEqual([]);
    expect(allowedTransitions("CANCELLED", "ADMIN")).toEqual([]);
  });

  it("nu permite sărirea pașilor", () => {
    expect(transitionPermission("PENDING", "SHIPPED")).toBeUndefined();
    expect(transitionPermission("SHIPPED", "CANCELLED")).toBeUndefined();
  });

  it("stocul se rezervă la confirmare și revine doar la anularea unei comenzi confirmate", () => {
    expect(stockEffect("PENDING", "CONFIRMED")).toBe("reserve");
    expect(stockEffect("CONFIRMED", "CANCELLED")).toBe("release");
    expect(stockEffect("PENDING", "CANCELLED")).toBe("none");
    expect(stockEffect("CONFIRMED", "SHIPPED")).toBe("none");
  });
});
