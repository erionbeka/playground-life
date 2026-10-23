/**
 * Brings up the local development stack in the right order:
 *   1. the Postgres container
 *   2. schema migrations
 *   3. the seed data (idempotent)
 *   4. the API server
 *
 * The API process is the last step and stays in the foreground, so Ctrl+C
 * stops it. Run `npm run dev` in a second terminal for the frontend.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForPostgres() {
  const probe = spawn("docker", ["exec", "playground-life-postgres", "pg_isready", "-U", "playground", "-d", "playground_life"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const ready = await new Promise((resolve) => {
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });

  return ready;
}

async function main() {
  console.log("> starting the Postgres container");
  await run("docker", ["compose", "up", "-d", "postgres"]);

  console.log("> waiting for Postgres to accept connections");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await waitForPostgres()) break;
    if (attempt === 29) {
      console.error("Postgres did not become ready in time.");
      process.exit(1);
    }
    await delay(1000);
  }

  console.log(`> applying migrations (DATABASE_URL should point at port ${POSTGRES_PORT})`);
  await run("npx", ["tsx", "server/migrate.ts"]);

  console.log("> seeding the clinic");
  await run("npx", ["tsx", "server/seed.ts"]);

  console.log("> starting the API");
  await run("npx", ["tsx", "watch", "server/index.ts"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});