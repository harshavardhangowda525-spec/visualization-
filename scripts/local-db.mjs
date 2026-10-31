import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
const db = await PGlite.create({
  dataDir: process.env.LOCAL_DB_DIR || ".local-db",
  extensions: { btree_gist },
});
const check = await db.query(
  "select to_regclass('public.users') as table_name",
);
if (!check.rows[0].table_name)
  await db.exec(
    readFileSync(
      new URL(
        "../prisma/migrations/202610310001_initial/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
const server = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: Number(process.env.LOCAL_DB_PORT) || 5433,
  maxConnections: 1,
});
await server.start();
console.log("Local PostgreSQL socket:", server.getServerConn());
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
