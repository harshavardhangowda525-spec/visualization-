// Vercel's entrypoint explicitly starts the compiled Nest app. tsc preserves DI metadata.
if (!process.env.WEB_ORIGIN && process.env.VERCEL_URL) {
  process.env.WEB_ORIGIN = `https://${process.env.VERCEL_URL}`;
}
const { bootstrap } = require("./dist/main.js");
bootstrap().catch(() => {
  console.error(
    "Studio API initialization failed. Check database and server environment configuration.",
  );
  process.exit(1);
});
