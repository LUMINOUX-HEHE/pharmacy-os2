import { describe, expect, it } from "@jest/globals";
import { nextReminderDate } from "@pharmacy-os/utils";

import { calculateReminderNextSendAt } from "../../src/modules/reminders/reminders.service.js";

describe("reminder scheduling", () => {
  const now = new Date("2026-05-04T09:00:00.000Z");

  it("sets weekly nextSendAt to now plus seven days", () => {
    expect(nextReminderDate(now, "WEEKLY").toISOString()).toBe("2026-05-11T09:00:00.000Z");
  });

  it("sets monthly nextSendAt to now plus thirty-ish calendar days", () => {
    expect(calculateReminderNextSendAt(now, "MONTHLY").toISOString()).toBe("2026-06-03T09:00:00.000Z");
  });

  it("recalculates from last send time instead of the original schedule", () => {
    const sentAt = new Date("2026-05-12T11:30:00.000Z");
    expect(calculateReminderNextSendAt(sentAt, "WEEKLY").toISOString()).toBe("2026-05-19T11:30:00.000Z");
  });

  it("keeps shared calendar reminder utility behavior explicit for monthly dates", () => {
    expect(nextReminderDate(now, "MONTHLY").toISOString()).toBe("2026-06-04T09:00:00.000Z");
  });
});
