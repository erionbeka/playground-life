import { closePool } from "./db.ts";
import { runMigrations } from "./migration.ts";

try {
  await runMigrations();
  console.log("Database migration completed");
} finally {
  await closePool();
}
