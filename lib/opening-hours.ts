/**
 * Shared opening-hours logic (client + server).
 * All wall-clock calculations use the branch IANA timezone via Intl — never the visitor's device TZ.
 */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type TimeRange = {
  open: string; // HH:MM
  close: string; // HH:MM
};

export type OpeningHours = Partial<Record<DayKey, TimeRange[]>>;

export type OrderingMode = "auto" | "force_open" | "force_closed";

export type BranchHoursInput = {
  opening_hours?: OpeningHours | null;
  timezone?: string | null;
  ordering_mode?: OrderingMode | null;
  working_hours?: string | null;
};

export type BranchStatus = {
  isOpen: boolean;
  reason: string;
  nextOpenAt: Date | null;
  todayHoursText: string;
};

export const DAY_KEYS: DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/** Display order for Arabic UI: Saturday → Friday */
export const ARABIC_DAY_ORDER: DayKey[] = [
  "sat",
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
];

export const DAY_LABELS_AR: Record<DayKey, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Damascus", label: "دمشق (Asia/Damascus)" },
  { value: "Asia/Beirut", label: "بيروت (Asia/Beirut)" },
  { value: "Asia/Amman", label: "عمّان (Asia/Amman)" },
  { value: "Asia/Riyadh", label: "الرياض (Asia/Riyadh)" },
  { value: "Asia/Dubai", label: "دبي (Asia/Dubai)" },
  { value: "Africa/Cairo", label: "القاهرة (Africa/Cairo)" },
  { value: "Europe/Istanbul", label: "إسطنبول (Europe/Istanbul)" },
  { value: "Asia/Jerusalem", label: "القدس (Asia/Jerusalem)" },
  { value: "UTC", label: "UTC" },
] as const;

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHHMM(value: string): boolean {
  return HHMM_RE.test(value);
}

export function parseHHMM(value: string): number {
  const m = HHMM_RE.exec(value);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHHMM(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hasStructuredHours(hours: OpeningHours | null | undefined): boolean {
  if (!hours) return false;
  return DAY_KEYS.some((d) => (hours[d]?.length ?? 0) > 0);
}

export function getDayPeriods(
  hours: OpeningHours | null | undefined,
  day: DayKey
): TimeRange[] {
  return hours?.[day] ?? [];
}

export function prevDay(day: DayKey): DayKey {
  const i = DAY_KEYS.indexOf(day);
  return DAY_KEYS[(i + 6) % 7]!;
}

export function nextDay(day: DayKey): DayKey {
  const i = DAY_KEYS.indexOf(day);
  return DAY_KEYS[(i + 1) % 7]!;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayKey: DayKey;
  minutesFromMidnight: number;
};

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const dayKey = WEEKDAY_TO_KEY[map.weekday ?? ""] ?? "mon";
  const hour = Number(map.hour);
  const minute = Number(map.minute);

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute,
    dayKey,
    minutesFromMidnight: hour * 60 + minute,
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timeZone: string
): Date {
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0
  );

  for (let i = 0; i < 3; i++) {
    const zoned = getZonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      0,
      0
    );
    const desired = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0
    );
    utc += desired - asUtc;
  }

  return new Date(utc);
}

function addCalendarDays(
  parts: { year: number; month: number; day: number },
  delta: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** True if `minutes` falls inside a period (supports overnight close < open). */
export function isMinutesInPeriod(
  minutes: number,
  period: TimeRange
): boolean {
  const open = parseHHMM(period.open);
  const close = parseHHMM(period.close);
  if (Number.isNaN(open) || Number.isNaN(close) || open === close) return false;

  if (close > open) {
    return minutes >= open && minutes < close;
  }
  // Overnight: [open, 24:00) U [0, close)
  return minutes >= open || minutes < close;
}

type ActivePeriod = {
  period: TimeRange;
  /** Calendar day the period is scheduled on (open day) */
  scheduleDay: DayKey;
  /** Close is on the next calendar day */
  overnight: boolean;
};

function findActivePeriod(
  hours: OpeningHours,
  dayKey: DayKey,
  minutes: number
): ActivePeriod | null {
  for (const period of getDayPeriods(hours, dayKey)) {
    const open = parseHHMM(period.open);
    const close = parseHHMM(period.close);
    if (Number.isNaN(open) || Number.isNaN(close) || open === close) continue;

    if (close > open) {
      if (minutes >= open && minutes < close) {
        return { period, scheduleDay: dayKey, overnight: false };
      }
    } else if (minutes >= open) {
      // Evening portion of overnight period
      return { period, scheduleDay: dayKey, overnight: true };
    }
  }

  const yesterday = prevDay(dayKey);
  for (const period of getDayPeriods(hours, yesterday)) {
    const open = parseHHMM(period.open);
    const close = parseHHMM(period.close);
    if (Number.isNaN(open) || Number.isNaN(close) || open === close) continue;
    if (close <= open && minutes < close) {
      return { period, scheduleDay: yesterday, overnight: true };
    }
  }

  return null;
}

function formatPeriodsText(periods: TimeRange[]): string {
  if (periods.length === 0) return "مغلق";
  return periods.map((p) => `${p.open} – ${p.close}`).join("، ");
}

export function formatWeeklyHoursText(hours: OpeningHours): string {
  return ARABIC_DAY_ORDER.map((day) => {
    const periods = getDayPeriods(hours, day);
    return `${DAY_LABELS_AR[day]}: ${formatPeriodsText(periods)}`;
  }).join("\n");
}

function findNextOpenAt(
  hours: OpeningHours,
  timeZone: string,
  now: Date,
  zoned: ZonedParts
): Date | null {
  // Remaining opens today after current minute
  for (const period of getDayPeriods(hours, zoned.dayKey)) {
    const open = parseHHMM(period.open);
    if (Number.isNaN(open)) continue;
    if (open > zoned.minutesFromMidnight) {
      return zonedTimeToUtc(
        {
          year: zoned.year,
          month: zoned.month,
          day: zoned.day,
          hour: Math.floor(open / 60),
          minute: open % 60,
        },
        timeZone
      );
    }
  }

  // Next 7 calendar days
  let dayKey = zoned.dayKey;
  let cal = { year: zoned.year, month: zoned.month, day: zoned.day };

  for (let i = 1; i <= 7; i++) {
    dayKey = nextDay(dayKey);
    cal = addCalendarDays(cal, 1);
    const periods = getDayPeriods(hours, dayKey);
    if (periods.length === 0) continue;

    const sorted = [...periods].sort(
      (a, b) => parseHHMM(a.open) - parseHHMM(b.open)
    );
    const first = sorted[0]!;
    const open = parseHHMM(first.open);
    if (Number.isNaN(open)) continue;

    return zonedTimeToUtc(
      {
        year: cal.year,
        month: cal.month,
        day: cal.day,
        hour: Math.floor(open / 60),
        minute: open % 60,
      },
      timeZone
    );
  }

  return null;
}

function formatNextOpenReason(nextOpenAt: Date | null, timeZone: string, now: Date): string {
  if (!nextOpenAt) return "مغلق الآن";

  const next = getZonedParts(nextOpenAt, timeZone);
  const nowZ = getZonedParts(now, timeZone);
  const timeStr = formatHHMM(next.minutesFromMidnight);

  const sameDay =
    next.year === nowZ.year && next.month === nowZ.month && next.day === nowZ.day;
  const tomorrowParts = addCalendarDays(
    { year: nowZ.year, month: nowZ.month, day: nowZ.day },
    1
  );
  const isTomorrow =
    next.year === tomorrowParts.year &&
    next.month === tomorrowParts.month &&
    next.day === tomorrowParts.day;

  if (sameDay) {
    return `مغلق الآن — يفتح اليوم الساعة ${timeStr}`;
  }
  if (isTomorrow) {
    return `مغلق الآن — يفتح غداً الساعة ${timeStr}`;
  }
  return `مغلق الآن — يفتح يوم ${DAY_LABELS_AR[next.dayKey]} الساعة ${timeStr}`;
}

export function getBranchStatus(
  branch: BranchHoursInput,
  now: Date = new Date()
): BranchStatus {
  const timeZone = branch.timezone || "Asia/Damascus";
  const mode: OrderingMode = branch.ordering_mode || "auto";
  const hours: OpeningHours = branch.opening_hours ?? {};
  const zoned = getZonedParts(now, timeZone);
  const todayPeriods = getDayPeriods(hours, zoned.dayKey);

  const structured = hasStructuredHours(hours);
  const todayHoursText = structured
    ? formatPeriodsText(todayPeriods)
    : branch.working_hours?.trim() || "غير محددة";

  if (mode === "force_open") {
    return {
      isOpen: true,
      reason: "مفتوح الآن (تجاوز يدوي)",
      nextOpenAt: null,
      todayHoursText,
    };
  }

  if (mode === "force_closed") {
    const nextOpenAt = structured
      ? findNextOpenAt(hours, timeZone, now, zoned)
      : null;
    return {
      isOpen: false,
      reason: "مغلق الآن (تجاوز يدوي)",
      nextOpenAt,
      todayHoursText,
    };
  }

  // auto: no weekly schedule configured → no time restriction (branch visibility is is_active)
  if (!structured) {
    return {
      isOpen: true,
      reason: "مفتوح الآن",
      nextOpenAt: null,
      todayHoursText,
    };
  }

  const active = findActivePeriod(hours, zoned.dayKey, zoned.minutesFromMidnight);

  if (active) {
    const closeStr = active.period.close;
    return {
      isOpen: true,
      reason: `مفتوح الآن حتى ${closeStr}`,
      nextOpenAt: null,
      todayHoursText,
    };
  }

  const nextOpenAt = findNextOpenAt(hours, timeZone, now, zoned);
  return {
    isOpen: false,
    reason: formatNextOpenReason(nextOpenAt, timeZone, now),
    nextOpenAt,
    todayHoursText,
  };
}

/** Detect overlapping periods on the same calendar day (for admin validation). */
export function periodsOverlap(periods: TimeRange[]): boolean {
  const normalized: { start: number; end: number }[] = [];

  for (const p of periods) {
    const open = parseHHMM(p.open);
    const close = parseHHMM(p.close);
    if (Number.isNaN(open) || Number.isNaN(close) || open === close) continue;

    if (close > open) {
      normalized.push({ start: open, end: close });
    } else {
      // Overnight: treat as [open, 24*60) for same-day overlap check against other ranges
      normalized.push({ start: open, end: 24 * 60 });
      // Morning part overlaps with early periods of same day
      normalized.push({ start: 0, end: close });
    }
  }

  normalized.sort((a, b) => a.start - b.start);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i]!.start < normalized[i - 1]!.end) return true;
  }
  return false;
}
