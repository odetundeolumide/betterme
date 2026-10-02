import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const dbDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db");
const migrations = [
  "schema.sql",
  "curriculum_schema.sql",
  "safeguarding_schema.sql",
  "notifications_schema.sql",
  "feedback_schema.sql",
];

try {
  for (const file of migrations) {
    const sql = await fs.readFile(path.join(dbDir, file), "utf8");
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
