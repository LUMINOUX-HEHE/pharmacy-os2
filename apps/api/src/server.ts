import { createServer } from "node:http";

import { app } from "./app.js";
import { env, isVercel } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";
import { initializeJobs } from "./jobs/index.js";
import { initializeSocket } from "./sockets/index.js";

const server = createServer(app);

if (!isVercel) {
  initializeSocket(server);
  initializeJobs();

  server.listen(env.PORT, () => {
    logger.info(`Pharmacy OS API listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}; shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

export default app;
