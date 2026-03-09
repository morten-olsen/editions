import { createApp } from "./app.ts";

const app = await createApp();

const shutdown = async (): Promise<void> => {
  await app.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.start();
