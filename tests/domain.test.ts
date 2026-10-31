import { describe, it, expect } from "vitest";
import {
  price,
  validateSlot,
  makeCode,
  codeValid,
  signature,
  constantEqual,
  canAccess,
  localParts,
} from "../apps/api/src/domain";
describe("integer pricing and membership eligibility arithmetic", () => {
  it("prorates duration and adds tax after discount", () =>
    expect(price(100000, 90, 1000, 1800)).toEqual({
      subtotalPaise: 150000,
      discountPaise: 15000,
      taxPaise: 24300,
      totalPaise: 159300,
      creditMinutes: 0,
    }));
  it("consumes only available duration credits before percentage discount", () =>
    expect(price(120000, 120, 1500, 1800, 60)).toEqual({
      subtotalPaise: 240000,
      discountPaise: 138000,
      taxPaise: 18360,
      totalPaise: 120360,
      creditMinutes: 60,
    }));
  it("rejects negative and fractional money", () => {
    expect(() => price(-1, 60, 0, 1800)).toThrow();
    expect(() => price(1.5, 60, 0, 1800)).toThrow();
  });
});
describe("business timezone booking rules", () => {
  const service = { minMinutes: 60, maxMinutes: 480, stepMinutes: 30 },
    hours = [{ weekday: 1, openMinute: 540, closeMinute: 1260 }],
    now = new Date("2026-11-01T00:00:00Z");
  it("uses Asia/Kolkata operating hours with UTC storage", () =>
    expect(
      validateSlot(
        new Date("2026-11-02T03:30Z"),
        new Date("2026-11-02T04:30Z"),
        service,
        hours,
        "Asia/Kolkata",
        now,
      ),
    ).toBe(60));
  it("rejects past, invalid duration, closed day and misaligned slots", () => {
    for (const [a, b] of [
      ["2026-10-31T04:30Z", "2026-10-31T05:30Z"],
      ["2026-11-02T03:30Z", "2026-11-02T03:45Z"],
      ["2026-11-03T03:30Z", "2026-11-03T04:30Z"],
      ["2026-11-02T03:40Z", "2026-11-02T04:40Z"],
    ])
      expect(() =>
        validateSlot(
          new Date(a),
          new Date(b),
          service,
          hours,
          "Asia/Kolkata",
          now,
        ),
      ).toThrow();
  });
  it("handles midnight conversion without server-local dates", () =>
    expect(localParts(new Date("2026-11-01T20:00Z"), "Asia/Kolkata").date).toBe(
      "2026-11-02",
    ));
});
describe("OTP and signature security", () => {
  const pepper = "x".repeat(32);
  it("creates unpredictable separately salted codes", () => {
    const a = makeCode(pepper),
      b = makeCode(pepper);
    expect(a.hash).not.toContain(a.code);
    expect(a.salt).not.toBe(b.salt);
  });
  it("rejects expired, replayed, exhausted and incorrect codes", () => {
    const a = makeCode(pepper),
      row = {
        ...a,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10000),
        consumedAt: null,
      };
    expect(codeValid(a.code, row, pepper)).toBe(true);
    expect(codeValid("wrong", row, pepper)).toBe(false);
    expect(codeValid(a.code, { ...row, attempts: 5 }, pepper)).toBe(false);
    expect(codeValid(a.code, { ...row, expiresAt: new Date(0) }, pepper)).toBe(
      false,
    );
    expect(codeValid(a.code, { ...row, consumedAt: new Date() }, pepper)).toBe(
      false,
    );
  });
  it("fails closed without a sufficiently long pepper", () =>
    expect(() => makeCode("")).toThrow());
  it("checks HMAC with length-safe comparisons", () => {
    const s = signature("order|payment", "secret");
    expect(constantEqual(s, s)).toBe(true);
    expect(constantEqual(s, signature("changed", "secret"))).toBe(false);
    expect(constantEqual("abc", "abc")).toBe(false);
  });
});
describe("ownership and assignment boundaries", () => {
  it("permits only owner, assigned staff or admin", () => {
    expect(canAccess({ id: "owner", role: "CUSTOMER" }, "owner")).toBe(true);
    expect(canAccess({ id: "other", role: "CUSTOMER" }, "owner")).toBe(false);
    expect(canAccess({ id: "staff", role: "STAFF" }, "owner", "staff")).toBe(
      true,
    );
    expect(canAccess({ id: "other", role: "STAFF" }, "owner", "staff")).toBe(
      false,
    );
    expect(canAccess({ id: "admin", role: "ADMIN" }, "owner")).toBe(true);
  });
});
