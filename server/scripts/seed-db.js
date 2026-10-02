import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const seedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "seed.sql");

try {
  const sql = await fs.readFile(seedPath, "utf8");
  await pool.query(sql);
  console.log("Sample exam content seeded.");
} catch (error) {
  console.error("Database seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
