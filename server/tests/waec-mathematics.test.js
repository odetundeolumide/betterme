import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "waec-mathematics.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");
const rows = [...sql.matchAll(
  /^\s*\('WAEC',(\d+),'([^']*)','(\[[^\]]*\])',(\d+),'([^']*)',([1-3])\),?$/gm
)];

test("WAEC Mathematics adds 39 valid multiple-choice questions for topic 11", () => {
  assert.equal(rows.length, 39);
  const stems = new Set();

  for (const row of rows) {
    const [, topicId, stem, rawOptions, rawAnswer, , rawDifficulty] = row;
    const options = JSON.parse(rawOptions);
    const answer = Number(rawAnswer);

    assert.equal(Number(topicId), 11);
    assert.ok(stem.trim().length > 0);
    assert.equal(options.length, 4);
    assert.ok(options.every((option) => typeof option === "string" && option.length > 0));
    assert.ok(Number.isInteger(answer) && answer >= 0 && answer < options.length);
    assert.ok(Number(rawDifficulty) >= 1 && Number(rawDifficulty) <= 3);
    assert.ok(!stems.has(stem), `duplicate question stem: ${stem}`);
    stems.add(stem);
  }
});
