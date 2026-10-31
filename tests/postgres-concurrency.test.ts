import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { BookingService } = require("../apps/api/dist/bookings.js");
// Requires a disposable, migrated and development-seeded PostgreSQL 16 database. Never point at production.
describe.skipIf(!process.env.TEST_POSTGRES_URL)(
  "PostgreSQL 16 multi-connection concurrency",
  () => {
    it("allows one of eight racing customers to reserve a period", async () => {
      const url = process.env.TEST_POSTGRES_URL!;
      const clients = Array.from(
        { length: 8 },
        () => new PrismaClient({ datasources: { db: { url } } }),
      );
      try {
        const studio = await clients[0].studio.findFirstOrThrow({
          include: { services: true },
        });
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + 14);
        start.setUTCHours(5, 0, 0, 0);
        const actors = await Promise.all(
          clients.map((db, i) =>
            db.user.create({
              data: {
                cognitoSub: "race-" + randomUUID(),
                phone:
                  "+91" +
                  String(Math.floor(Math.random() * 9000000000) + 1000000000),
              },
            }),
          ),
        );
        const results = await Promise.allSettled(
          clients.map((db, i) =>
            new BookingService(db).hold(actors[i], {
              studioId: studio.id,
              serviceId: studio.services[0].id,
              startsAt: start.toISOString(),
              minutes: 60,
              idempotencyKey: randomUUID(),
            }),
          ),
        );
        expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      } finally {
        await Promise.all(clients.map((c) => c.$disconnect()));
      }
    });
  },
);
