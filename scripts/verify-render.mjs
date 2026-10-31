// Local deployment smoke test only. This database is never used by start:render.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
assert(
  existsSync("apps/web/.next/BUILD_ID"),
  "Run npm run build before this smoke test.",
);
const db = await PGlite.create({ extensions: { btree_gist } });
await db.exec(
  readFileSync("prisma/migrations/202610310001_initial/migration.sql", "utf8"),
);
const socket = new PGLiteSocketServer({
  db,
  port: 0,
  host: "127.0.0.1",
  maxConnections: 10,
});
await socket.start();
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1&pgbouncer=true`,
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "preview",
  SEED_PREVIEW_CATALOGUE: "true",
  RUN_DATABASE_MIGRATIONS: "false",
  ENABLE_MAINTENANCE_WORKER: "true",
  PORT: "11001",
  WEB_ORIGIN: "https://render-preview.test",
  API_INTERNAL_URL: "http://127.0.0.1:4000",
  OTP_PEPPER: randomBytes(32).toString("hex"),
  LOG_LEVEL: "warn",
  COGNITO_USER_POOL_ID: "",
  COGNITO_CLIENT_ID: "",
  RAZORPAY_KEY_ID: "",
  RAZORPAY_KEY_SECRET: "",
  SES_FROM_EMAIL: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const app = spawn(process.execPath, ["scripts/render-start.mjs"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
app.stdout.on("data", (b) => {
  output += b.toString();
});
app.stderr.on("data", (b) => {
  output += b.toString();
});
const exited = new Promise((resolve) => app.once("exit", resolve));
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null)
      throw new Error("Launcher exited before readiness.");
    try {
      const response = await fetch("http://127.0.0.1:11001/api/v1/health", {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok && (await response.json()).status === "ok") {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert(ready, "Next-to-Nest database health check timed out.");
  const studios = await (
    await fetch("http://127.0.0.1:11001/api/v1/studios")
  ).json();
  assert.equal(
    studios.items.length,
    3,
    "Preview seeding must reach the public API proxy.",
  );
  const home = await (await fetch("http://127.0.0.1:11001/")).text();
  assert(
    home.includes("Preview environment") &&
      home.includes(studios.items[0].name),
    "SSR must use the same backend and mark sample data.",
  );
  assert.equal(
    (await fetch("http://127.0.0.1:11001/api/v1/admin/dashboard")).status,
    401,
  );
  const otp = await fetch("http://127.0.0.1:11001/api/v1/auth/otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+919999999991", register: false }),
  });
  assert.equal(
    otp.status,
    503,
    "Missing Cognito credentials must never allow a test login.",
  );
  for (
    let i = 0;
    i < 20 && !output.includes("Maintenance worker completed.");
    i++
  )
    await delay(250);
  assert(
    output.includes("Maintenance worker completed."),
    "The preview maintenance runner must complete a cycle.",
  );
  console.log(
    "Render smoke test passed: supervisor, secure preview seed, web/API proxy, database health, SSR catalogue, protected admin, authentication fail-closed, maintenance worker.",
  );
} catch (error) {
  console.error("Render smoke test failed:", error.message);
  process.exitCode = 1;
} finally {
  app.kill("SIGTERM");
  await Promise.race([
    exited,
    delay(15000, undefined, { ref: false }).then(() => {
      app.kill("SIGKILL");
    }),
  ]);
  await socket.stop();
  await db.close();
}
