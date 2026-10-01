import { describe, expect, it } from "vitest";
import {
  getBranchStatus,
  getZonedParts,
  isMinutesInPeriod,
  periodsOverlap,
  type OpeningHours,
} from "./opening-hours";

/** Build a Date that shows as the given wall clock in Asia/Damascus. */
function damascusLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  // Asia/Damascus is typically UTC+3 (no DST currently)
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));
}

const weekdaySchedule: OpeningHours = {
  mon: [{ open: "09:00", close: "22:00" }],
  tue: [{ open: "09:00", close: "22:00" }],
  wed: [{ open: "09:00", close: "22:00" }],
  thu: [{ open: "09:00", close: "22:00" }],
  fri: [{ open: "09:00", close: "22:00" }],
  sat: [{ open: "10:00", close: "23:00" }],
  sun: [],
};

describe("isMinutesInPeriod", () => {
  it("handles same-day periods", () => {
    expect(isMinutesInPeriod(12 * 60, { open: "09:00", close: "22:00" })).toBe(
      true
    );
    expect(isMinutesInPeriod(8 * 60, { open: "09:00", close: "22:00" })).toBe(
      false
    );
  });

  it("handles overnight periods", () => {
    expect(isMinutesInPeriod(20 * 60, { open: "18:00", close: "02:00" })).toBe(
      true
    );
    expect(isMinutesInPeriod(1 * 60, { open: "18:00", close: "02:00" })).toBe(
      true
    );
    expect(isMinutesInPeriod(3 * 60, { open: "18:00", close: "02:00" })).toBe(
      false
    );
  });
});

describe("getBranchStatus — normal day", () => {
  it("is open during scheduled hours", () => {
    // 2026-04-06 is a Monday
    const now = damascusLocal(2026, 4, 6, 12, 0);
    expect(getZonedParts(now, "Asia/Damascus").dayKey).toBe("mon");

    const status = getBranchStatus(
      {
        opening_hours: weekdaySchedule,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );

    expect(status.isOpen).toBe(true);
    expect(status.reason).toContain("مفتوح الآن حتى 22:00");
    expect(status.todayHoursText).toContain("09:00");
  });

  it("is closed before opening", () => {
    const now = damascusLocal(2026, 4, 6, 8, 0);
    const status = getBranchStatus(
      {
        opening_hours: weekdaySchedule,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );

    expect(status.isOpen).toBe(false);
    expect(status.reason).toContain("يفتح اليوم الساعة 09:00");
    expect(status.nextOpenAt).not.toBeNull();
  });
});

describe("getBranchStatus — overnight", () => {
  const overnight: OpeningHours = {
    mon: [{ open: "18:00", close: "02:00" }],
  };

  it("is open in the evening of the scheduled day", () => {
    const now = damascusLocal(2026, 4, 6, 20, 0); // Mon 20:00
    const status = getBranchStatus(
      {
        opening_hours: overnight,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(true);
    expect(status.reason).toContain("حتى 02:00");
  });

  it("is still open after midnight from yesterday's period", () => {
    const now = damascusLocal(2026, 4, 7, 1, 0); // Tue 01:00 — Mon overnight
    expect(getZonedParts(now, "Asia/Damascus").dayKey).toBe("tue");

    const status = getBranchStatus(
      {
        opening_hours: overnight,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(true);
  });

  it("closes after overnight end", () => {
    const now = damascusLocal(2026, 4, 7, 2, 30); // Tue 02:30
    const status = getBranchStatus(
      {
        opening_hours: overnight,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(false);
  });
});

describe("getBranchStatus — closed day", () => {
  it("reports closed on Sunday and next open Monday", () => {
    const now = damascusLocal(2026, 4, 5, 15, 0); // Sunday
    expect(getZonedParts(now, "Asia/Damascus").dayKey).toBe("sun");

    const status = getBranchStatus(
      {
        opening_hours: weekdaySchedule,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );

    expect(status.isOpen).toBe(false);
    expect(status.todayHoursText).toBe("مغلق");
    expect(status.reason).toContain("يفتح غداً الساعة 09:00");
  });
});

describe("getBranchStatus — two periods", () => {
  const twoPeriods: OpeningHours = {
    mon: [
      { open: "09:00", close: "14:00" },
      { open: "17:00", close: "23:00" },
    ],
  };

  it("is closed between periods", () => {
    const now = damascusLocal(2026, 4, 6, 15, 0);
    const status = getBranchStatus(
      {
        opening_hours: twoPeriods,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(false);
    expect(status.reason).toContain("يفتح اليوم الساعة 17:00");
  });

  it("is open in the second period", () => {
    const now = damascusLocal(2026, 4, 6, 18, 30);
    const status = getBranchStatus(
      {
        opening_hours: twoPeriods,
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(true);
  });
});

describe("getBranchStatus — timezone switch", () => {
  const hours: OpeningHours = {
    mon: [{ open: "09:00", close: "17:00" }],
  };

  it("can be open in Damascus and closed in UTC for the same instant", () => {
    // 2026-04-06 07:00 UTC = 10:00 Damascus (+3) → open
    // same instant in UTC wall clock: 07:00 → closed (before 09:00)
    const instant = new Date(Date.UTC(2026, 3, 6, 7, 0, 0));

    const damascus = getBranchStatus(
      { opening_hours: hours, timezone: "Asia/Damascus", ordering_mode: "auto" },
      instant
    );
    const utc = getBranchStatus(
      { opening_hours: hours, timezone: "UTC", ordering_mode: "auto" },
      instant
    );

    expect(damascus.isOpen).toBe(true);
    expect(utc.isOpen).toBe(false);
  });
});

describe("getBranchStatus — ordering_mode overrides", () => {
  it("force_open ignores schedule", () => {
    const now = damascusLocal(2026, 4, 5, 3, 0); // Sunday closed day, night
    const status = getBranchStatus(
      {
        opening_hours: weekdaySchedule,
        timezone: "Asia/Damascus",
        ordering_mode: "force_open",
      },
      now
    );
    expect(status.isOpen).toBe(true);
    expect(status.reason).toContain("تجاوز يدوي");
  });

  it("force_closed ignores schedule", () => {
    const now = damascusLocal(2026, 4, 6, 12, 0);
    const status = getBranchStatus(
      {
        opening_hours: weekdaySchedule,
        timezone: "Asia/Damascus",
        ordering_mode: "force_closed",
      },
      now
    );
    expect(status.isOpen).toBe(false);
    expect(status.reason).toContain("تجاوز يدوي");
  });
});

describe("getBranchStatus — empty schedule", () => {
  it("treats empty opening_hours as open in auto mode", () => {
    const now = damascusLocal(2026, 4, 6, 3, 0);
    const status = getBranchStatus(
      {
        opening_hours: {},
        timezone: "Asia/Damascus",
        ordering_mode: "auto",
      },
      now
    );
    expect(status.isOpen).toBe(true);
    expect(status.reason).toBe("مفتوح الآن");
  });
});

describe("periodsOverlap", () => {
  it("detects overlapping same-day periods", () => {
    expect(
      periodsOverlap([
        { open: "09:00", close: "14:00" },
        { open: "13:00", close: "18:00" },
      ])
    ).toBe(true);
  });

  it("allows non-overlapping periods", () => {
    expect(
      periodsOverlap([
        { open: "09:00", close: "14:00" },
        { open: "17:00", close: "23:00" },
      ])
    ).toBe(false);
  });
});
