// Applies every migrations/*.sql file, in filename order, against DATABASE_URL.
// Statements use IF NOT EXISTS, so re-running is safe.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(join(root, file));
  } catch {
    // file doesn't exist — fine, the var may come from the shell
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Put your Neon connection string in .env.local or the environment."
  );
  process.exit(1);
}

const sql = neon(url);
const dir = join(root, "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const statements = readFileSync(join(dir, file), "utf8")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) =>
      s.split("\n").some((line) => line.trim() && !line.trim().startsWith("--"))
    );
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`applied ${file} (${statements.length} statements)`);
}
console.log("migrations complete");
