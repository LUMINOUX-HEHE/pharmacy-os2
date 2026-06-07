import { afterAll, jest } from "@jest/globals";
import type { Job } from "bull";

import { redis } from "../src/config/redis.js";
import { allQueues } from "../src/jobs/queues.js";
import { prisma } from "../src/config/prisma.js";

for (const queue of allQueues) {
  jest.spyOn(queue, "add").mockResolvedValue({ id: `test-${queue.name}` } as unknown as Job<unknown>);
}

afterAll(async () => {
  await Promise.allSettled(allQueues.map((queue) => queue.close()));
  if (redis.status !== "end") {
    redis.disconnect();
  }
  await prisma.$disconnect();
});
