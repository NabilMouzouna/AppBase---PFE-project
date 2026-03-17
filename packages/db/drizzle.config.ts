import { defineConfig } from "drizzle-kit";
import path from "node:path";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: path.resolve(process.env["DB_PATH"] ?? "data/appbase.sqlite"),
  },
});
