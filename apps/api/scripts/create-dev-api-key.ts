/**
 * Creates an API key for local development.
 * Run: pnpm --filter api exec tsx scripts/create-dev-api-key.ts
 *
 * Start the API at least once first so the DB exists.
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@appbase/db";
import * as schema from "@appbase/db/schema";
import { createAuth } from "../src/lib/auth";
import { loadEnv } from "../src/config/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../.env"), quiet: true });

const env = loadEnv(process.env);
const dbPath = path.resolve(process.cwd(), env.DB_PATH);
const db = createDb(dbPath);

const APP_USER_ID = "app-default-bootstrap";

async function ensureBootstrapUser() {
  const users = await db.select().from(schema.user);
  if (users.some((u) => u.id === APP_USER_ID)) return;

  const now = new Date();
  await db.insert(schema.user).values({
    id: APP_USER_ID,
    name: "App Bootstrap",
    email: "bootstrap@appbase.local",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  await ensureBootstrapUser();

  const auth = createAuth(db, env.BASE_URL, env.AUTH_SECRET);
  const result = await auth.api.createApiKey({
    body: {
      name: "dev-api-key",
      userId: APP_USER_ID,
      expiresIn: 60 * 60 * 24 * 365, // 1 year
    },
  });

  const key = (result as { key?: string })?.key;
  if (!key) {
    console.error("Failed to create API key");
    process.exit(1);
  }

  console.log("\nAPI key created. Add to api.http:\n");
  console.log(`  @apiKey = ${key}\n`);
  console.log("Then add header to each request: x-api-key: {{apiKey}}\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
