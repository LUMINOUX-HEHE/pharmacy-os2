import Queue from "bull";

import { env, isTest, isVercel } from "../config/env.js";
import { logger } from "../config/logger.js";

const createQueue = <TData = unknown>(name: string): Queue.Queue<TData> => {
  if (isTest || isVercel) {
    return {
      name,
      add: async (jobName: string, data: TData) =>
        ({
          id: `test-${name}-${jobName}`,
          name: jobName,
          data
        }) as unknown as Queue.Job<TData>,
      close: async () => undefined,
      on: () => undefined,
      process: () => undefined
    } as unknown as Queue.Queue<TData>;
  }

  return new Queue(name, env.REDIS_URL);
};

export const reminderQueue = createQueue("reminder-queue");
export const expiryAlertQueue = createQueue("expiry-alert-queue");
export const reorderAlertQueue = createQueue("reorder-alert-queue");
export const reportGenerationQueue = createQueue("report-generation-queue");

export const allQueues = [reminderQueue, expiryAlertQueue, reorderAlertQueue, reportGenerationQueue] as const;

export const addQueueJob = async <TData>(
  queue: Queue.Queue<TData>,
  name: string,
  data: TData,
  options?: Queue.JobOptions
): Promise<Queue.Job<TData> | null> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      queue.add(name, data, options),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Queue add timed out")), 1200);
      })
    ]);
  } catch (error) {
    logger.warn("Background queue unavailable; job skipped", {
      queue: queue.name,
      job: name,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
