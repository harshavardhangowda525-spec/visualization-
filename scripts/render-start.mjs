import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { renderConfig } from "./render-config.mjs";
const children = new Set();
let stopping = false;
let workerRunning = false;
let workerTimer;
function stop(code) {
  if (stopping) return;
  stopping = true;
  clearInterval(workerTimer);
  for (const child of children) child.kill("SIGTERM");
  if (!children.size) process.exit(code);
  const forced = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 10000);
  const done = () => {
    if (!children.size) {
      clearTimeout(forced);
      process.exit(code);
    }
  };
  for (const child of children) child.once("exit", done);
}
function launch(args, overrides = {}, critical = false) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, ...overrides },
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (critical && !stopping) {
      console.error(
        "A required application process exited; shutting down the service.",
      );
      stop(code || 1);
    }
  });
  child.once("error", () => {
    console.error("Unable to launch application process.");
    if (critical) stop(1);
  });
  return child;
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = launch(args);
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Deployment initialization failed.")),
    );
  });
}
async function waitForApi() {
  const deadline = Date.now() + 120000;
  while (!stopping && Date.now() < deadline) {
    try {
      const result = await fetch("http://127.0.0.1:4000/api/v1/health", {
        signal: AbortSignal.timeout(2000),
      });
      if (result.ok && (await result.json()).status === "ok") return;
    } catch {}
    await delay(500);
  }
  throw new Error(
    "The API did not become ready; the frontend was not started.",
  );
}
function maintenance() {
  if (stopping || workerRunning) return;
  workerRunning = true;
  const worker = launch(["scripts/worker.mjs"]);
  worker.once("error", () => {
    workerRunning = false;
  });
  worker.once("exit", (code) => {
    workerRunning = false;
    if (code && !stopping)
      console.error("Maintenance failed; it will retry at the next interval.");
  });
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => stop(0));
try {
  const config = renderConfig(process.env);
  Object.assign(process.env, {
    NODE_ENV: "production",
    DATABASE_URL: config.databaseUrl,
    WEB_ORIGIN: config.origin,
    API_INTERNAL_URL: "http://127.0.0.1:4000",
  });
  if (config.migrate)
    await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (config.seed) await run(["--import", "tsx", "prisma/seed.ts"]);
  if (stopping) process.exit(0);
  launch(
    ["apps/api/dist/main.js"],
    { PORT: "4000", API_BIND_HOST: "127.0.0.1" },
    true,
  );
  await waitForApi();
  if (stopping) process.exit(0);
  launch(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "apps/web",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(config.port),
    ],
    {},
    true,
  );
  if (config.worker) {
    maintenance();
    workerTimer = setInterval(maintenance, 60000);
  }
  console.log(
    "Studio web and API started. Provider-backed authentication and payments require configured credentials.",
  );
} catch {
  console.error(
    "Render startup failed. Check database access, migrations, origin and secret configuration.",
  );
  stop(1);
}
