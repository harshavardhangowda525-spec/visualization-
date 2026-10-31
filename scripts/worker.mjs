import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Db } = require("../apps/api/dist/db.js");
const { runMaintenance } = require("../apps/api/dist/maintenance.js");
const db = new Db();
try {
  await runMaintenance(db);
  console.log("Maintenance worker completed.");
} finally {
  await db.$disconnect();
}
