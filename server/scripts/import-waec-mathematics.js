import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "waec-mathematics.sql"
);

try {
  const sql = await fs.readFile(sqlPath, "utf8");
  const result = await pool.query(sql);
  console.log(`WAEC Mathematics bank imported: ${result.rowCount} new questions.`);
} catch (error) {
  console.error("WAEC Mathematics import failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
