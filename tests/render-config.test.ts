import { describe, it, expect } from "vitest";
// @ts-expect-error the deployment launcher is a Node ESM module.
import { renderConfig } from "../scripts/render-config.mjs";
const base = {
  DATABASE_URL: "postgresql://test:test@127.0.0.1/test",
  OTP_PEPPER: "a".repeat(40),
  WEB_ORIGIN: "https://studio.example.com",
  API_INTERNAL_URL: "http://127.0.0.1:4000",
};
describe("Render deployment boundaries", () => {
  it("requires a persistent database and a strong OTP secret", () => {
    expect(() => renderConfig({ ...base, DATABASE_URL: "" })).toThrow(
      "PostgreSQL",
    );
    expect(() => renderConfig({ ...base, OTP_PEPPER: "short" })).toThrow(
      "OTP_PEPPER",
    );
  });
  it("bounds database pools while preserving an explicitly configured limit", () => {
    expect(
      new URL(renderConfig(base).databaseUrl).searchParams.get(
        "connection_limit",
      ),
    ).toBe("5");
    expect(
      new URL(
        renderConfig({
          ...base,
          DATABASE_URL: base.DATABASE_URL + "?connection_limit=2",
        }).databaseUrl,
      ).searchParams.get("connection_limit"),
    ).toBe("2");
  });
  it("keeps the internal API and public web listener separate", () => {
    expect(renderConfig({ ...base, PORT: "10000" }).port).toBe(10000);
    for (const PORT of ["4000", "NaN", "0", "65536"])
      expect(() => renderConfig({ ...base, PORT })).toThrow("PORT");
    expect(() =>
      renderConfig({ ...base, API_INTERNAL_URL: "https://other.example.com" }),
    ).toThrow("API_INTERNAL_URL");
  });
  it("requires an exact HTTPS origin for secure cookies and CSRF checks", () => {
    for (const WEB_ORIGIN of [
      "http://studio.example.com",
      "https://studio.example.com/",
      "https://studio.example.com/path",
      "invalid",
    ])
      expect(() => renderConfig({ ...base, WEB_ORIGIN })).toThrow("WEB_ORIGIN");
    expect(
      renderConfig({
        ...base,
        WEB_ORIGIN: undefined,
        RENDER_EXTERNAL_URL: base.WEB_ORIGIN,
      }).origin,
    ).toBe(base.WEB_ORIGIN);
  });
  it("blocks development catalogue data and startup migrations in a production release", () => {
    expect(() =>
      renderConfig({ ...base, SEED_PREVIEW_CATALOGUE: "true" }),
    ).toThrow("seeding");
    expect(() =>
      renderConfig({ ...base, RUN_DATABASE_MIGRATIONS: "true" }),
    ).toThrow("release job");
    expect(renderConfig(base)).toMatchObject({
      seed: false,
      migrate: false,
      worker: false,
    });
  });
  it("allows explicit preview initialization without treating string false as true", () => {
    expect(
      renderConfig({
        ...base,
        DEPLOYMENT_ENV: "preview",
        SEED_PREVIEW_CATALOGUE: "true",
        RUN_DATABASE_MIGRATIONS: "true",
        ENABLE_MAINTENANCE_WORKER: "true",
      }),
    ).toMatchObject({ seed: true, migrate: true, worker: true });
    expect(
      renderConfig({
        ...base,
        DEPLOYMENT_ENV: "preview",
        SEED_PREVIEW_CATALOGUE: "false",
        RUN_DATABASE_MIGRATIONS: "false",
        ENABLE_MAINTENANCE_WORKER: "false",
      }),
    ).toMatchObject({ seed: false, migrate: false, worker: false });
  });
});
