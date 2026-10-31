import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync, existsSync } from "node:fs";
if (process.env.NODE_ENV === "production")
  throw new Error(
    "Use separate production services, not the development launcher.",
  );
process.env.PREVIEW_PRODUCTION ||= "1";
const portIndex = process.argv.indexOf("--port");
const webPort =
  portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || "3000";
process.env.PORT = webPort;
const children = [];
function run(command, args, extra = {}) {
  const p = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extra },
  });
  children.push(p);
  p.on("error", (e) => console.error("Unable to start child:", e.message));
  p.on("exit", (code) => {
    if (code) console.error("Child process failed:", args[0], code);
  });
  return p;
}
function finish(p) {
  return new Promise((resolve, reject) => {
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Child process exited " + code)),
    );
    p.on("error", reject);
  });
}
let db, server;
if (!process.env.DATABASE_URL) {
  db = await PGlite.create({
    dataDir: ".local-db",
    extensions: { btree_gist },
  });
  const exists = await db.query("select to_regclass('public.users') as name");
  if (!exists.rows[0].name)
    await db.exec(
      readFileSync(
        "prisma/migrations/202610310001_initial/migration.sql",
        "utf8",
      ),
    );
  server = new PGLiteSocketServer({
    db,
    port: 5433,
    host: "127.0.0.1",
    maxConnections: 10,
  });
  await server.start();
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5433/postgres?connection_limit=1&pgbouncer=true";
  console.log(
    "Embedded development database started. Use PostgreSQL 16 for release verification.",
  );
}
process.env.OTP_PEPPER ||= randomBytes(32).toString("hex");
process.env.WEB_ORIGIN ||= "http://localhost:3000";
await finish(run(process.execPath, ["--import", "tsx", "prisma/seed.ts"]));
await finish(run("npm", ["run", "build", "-w", "apps/api"]));
run(process.execPath, ["apps/api/dist/main.js"], {
  PORT: "4000",
  LOG_LEVEL: "warn",
});
if (
  process.env.PREVIEW_PRODUCTION === "1" &&
  !existsSync("apps/web/.next/BUILD_ID")
)
  await finish(run("npm", ["run", "build", "-w", "apps/web"]));
run(process.execPath, [
  "node_modules/next/dist/bin/next",
  process.env.PREVIEW_PRODUCTION === "1" ||
  process.env.SITES_MANAGED_LINUX_CONTAINER === "1"
    ? "start"
    : "dev",
  "apps/web",
  "--hostname",
  "0.0.0.0",
  "--port",
  webPort,
  ...(process.env.PREVIEW_PRODUCTION === "1" ||
  process.env.SITES_MANAGED_LINUX_CONTAINER === "1"
    ? []
    : ["--webpack"]),
]);
async function stop() {
  for (const c of children) c.kill("SIGTERM");
  await server?.stop();
  await db?.close();
  process.exit(0);
}
for (const event of ["SIGINT", "SIGTERM"]) process.on(event, stop);
