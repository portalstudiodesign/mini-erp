import { describe, expect, it } from "vitest";
import { isValidCui, normalizeCui } from "../../src/lib/cui.js";

describe("isValidCui", () => {
  it("acceptă un CUI cu cifră de control corectă, cu sau fără RO", () => {
    expect(isValidCui("14399840")).toBe(true);
    expect(isValidCui("RO14399840")).toBe(true);
    expect(isValidCui("ro 1439 9840")).toBe(true);
  });

  it("respinge cifra de control greșită", () => {
    expect(isValidCui("14399841")).toBe(false);
  });

  it("respinge formate invalide", () => {
    expect(isValidCui("")).toBe(false);
    expect(isValidCui("1")).toBe(false);
    expect(isValidCui("12345678901")).toBe(false);
    expect(isValidCui("RO12A45")).toBe(false);
  });
});

describe("normalizeCui", () => {
  it("elimină spațiile și pune litere mari", () => {
    expect(normalizeCui(" ro 123 ")).toBe("RO123");
  });
});
