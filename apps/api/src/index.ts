import { buildApp } from "./app";
import { loadEnv } from "./config/env";

async function main() {
  const env = loadEnv(process.env);
  const app = await buildApp({ env });

  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Shutting down AppBase API");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(
    { host: env.HOST, port: env.PORT, dbPath: env.DB_PATH },
    "AppBase API started",
  );
}

try {
  await main();
} catch (error) {
  console.error("Failed to start AppBase API", error);
  process.exit(1);
}
