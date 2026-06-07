import { logger } from "../config/logger.js";

import { registerExpiryAlertJob } from "./expiry-alert.job.js";
import { allQueues } from "./queues.js";
import { registerReminderJob } from "./reminder.job.js";
import { registerReorderAlertJob } from "./reorder-alert.job.js";
import { registerReportJob } from "./report.job.js";

export const initializeJobs = (): void => {
  registerReminderJob();
  registerExpiryAlertJob();
  registerReorderAlertJob();
  registerReportJob();

  allQueues.forEach((queue) => {
    queue.on("failed", (job, error) => {
      logger.error("Background job failed", { queue: queue.name, jobId: job.id, message: error.message });
    });
  });
};
