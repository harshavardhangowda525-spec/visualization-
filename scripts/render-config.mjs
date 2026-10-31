/** Validate the same-origin Render deployment before starting any processes. */
export function renderConfig(env) {
  if (!env.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL))
    throw new Error(
      "A PostgreSQL DATABASE_URL is required; an embedded database is never used on Render.",
    );
  if (!env.OTP_PEPPER || env.OTP_PEPPER.length < 32)
    throw new Error(
      "OTP_PEPPER must be a securely generated secret of at least 32 characters.",
    );
  let database;
  try {
    database = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("A valid PostgreSQL DATABASE_URL is required.");
  }
  if (!database.hostname || !database.pathname || database.pathname === "/")
    throw new Error(
      "DATABASE_URL must identify a PostgreSQL host and database.",
    );
  // Bound each API/maintenance pool for the small preview instance.
  if (!database.searchParams.has("connection_limit"))
    database.searchParams.set("connection_limit", "5");
  if (!database.searchParams.has("pool_timeout"))
    database.searchParams.set("pool_timeout", "10");
  const origin = env.WEB_ORIGIN || env.RENDER_EXTERNAL_URL;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("A valid WEB_ORIGIN is required.");
  }
  if (parsed.protocol !== "https:" || parsed.origin !== origin)
    throw new Error(
      "WEB_ORIGIN must be the exact HTTPS frontend origin, without a trailing slash or path.",
    );
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4000)
    throw new Error(
      "PORT must be a valid public port distinct from the internal API port 4000.",
    );
  if (env.API_INTERNAL_URL && env.API_INTERNAL_URL !== "http://127.0.0.1:4000")
    throw new Error(
      "This Render launcher requires API_INTERNAL_URL=http://127.0.0.1:4000 at build and runtime.",
    );
  const preview = env.DEPLOYMENT_ENV === "preview";
  const seed = env.SEED_PREVIEW_CATALOGUE === "true";
  const migrate = env.RUN_DATABASE_MIGRATIONS === "true";
  if (seed && !preview)
    throw new Error(
      "Preview catalogue seeding is forbidden outside DEPLOYMENT_ENV=preview.",
    );
  if (migrate && !preview)
    throw new Error(
      "Run reviewed production migrations as a separate release job.",
    );
  return {
    databaseUrl: database.toString(),
    port,
    origin,
    seed,
    migrate,
    worker: env.ENABLE_MAINTENANCE_WORKER === "true",
  };
}
