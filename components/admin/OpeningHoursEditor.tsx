"use client";

import { Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ARABIC_DAY_ORDER,
  DAY_LABELS_AR,
  isValidHHMM,
  type DayKey,
  type OpeningHours,
  type TimeRange,
} from "@/lib/opening-hours";

function periodsFor(hours: OpeningHours, day: DayKey): TimeRange[] {
  return hours[day] ?? [];
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0")
);

function splitHHMM(value: string): { h: string; m: string } {
  if (isValidHHMM(value)) {
    return { h: value.slice(0, 2), m: value.slice(3, 5) };
  }
  return { h: "09", m: "00" };
}

/** Always shows 24h (00–23) — never browser AM/PM. */
function Time24Select({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { h, m } = splitHHMM(value);
  const minuteOptions = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  return (
    <div className="w-auto">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-stone-700">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1" dir="ltr">
        <select
          aria-label={label ? `${label} — الساعة` : "الساعة"}
          className="h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={h}
          onChange={(e) => onChange(`${e.target.value}:${m}`)}
        >
          {HOURS_24.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <span className="text-stone-500">:</span>
        <select
          aria-label={label ? `${label} — الدقيقة` : "الدقيقة"}
          className="h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={m}
          onChange={(e) => onChange(`${h}:${e.target.value}`)}
        >
          {minuteOptions.map((min) => (
            <option key={min} value={min}>
              {min}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  function setDayOpen(day: DayKey, open: boolean) {
    const next = { ...value };
    if (open) {
      next[day] = [{ open: "08:00", close: "22:00" }];
    } else {
      next[day] = [];
    }
    onChange(next);
  }

  function updatePeriod(
    day: DayKey,
    index: number,
    patch: Partial<TimeRange>
  ) {
    const list = [...periodsFor(value, day)];
    list[index] = { ...list[index]!, ...patch };
    onChange({ ...value, [day]: list });
  }

  function addPeriod(day: DayKey) {
    const list = [...periodsFor(value, day)];
    list.push({ open: "17:00", close: "23:00" });
    onChange({ ...value, [day]: list });
  }

  function removePeriod(day: DayKey, index: number) {
    const list = periodsFor(value, day).filter((_, i) => i !== index);
    onChange({ ...value, [day]: list.length ? list : [] });
  }

  function copyDayToAll(source: DayKey) {
    const template = periodsFor(value, source).map((p) => ({ ...p }));
    const next: OpeningHours = { ...value };
    for (const day of ARABIC_DAY_ORDER) {
      next[day] = template.map((p) => ({ ...p }));
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-stone-800">
          ساعات العمل الأسبوعية
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          بنظام 24 ساعة (مثال: من 08:00 إلى 22:00) — بدون AM/PM
        </p>
      </div>
      <div className="space-y-2">
        {ARABIC_DAY_ORDER.map((day) => {
          const periods = periodsFor(value, day);
          const isOpen = periods.length > 0;
          return (
            <div
              key={day}
              className="rounded-lg border border-stone-200 bg-stone-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setDayOpen(day, e.target.checked)}
                  />
                  {DAY_LABELS_AR[day]}
                  <span className="font-normal text-stone-500">
                    {isOpen ? "مفتوح" : "مغلق"}
                  </span>
                </label>
                {isOpen && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addPeriod(day)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة فترة ثانية
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyDayToAll(day)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      نسخ هذا اليوم لكل الأيام
                    </Button>
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="mt-2 space-y-2">
                  {periods.map((period, index) => (
                    <div
                      key={`${day}-${index}`}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <Time24Select
                        label={index === 0 ? "من" : undefined}
                        value={period.open}
                        onChange={(open) =>
                          updatePeriod(day, index, { open })
                        }
                      />
                      <span className="mb-2.5 text-sm text-stone-500">إلى</span>
                      <Time24Select
                        label={index === 0 ? "إلى" : undefined}
                        value={period.close}
                        onChange={(close) =>
                          updatePeriod(day, index, { close })
                        }
                      />
                      {periods.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="حذف الفترة"
                          onClick={() => removePeriod(day, index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-stone-500">
                    للإغلاق بعد منتصف الليل: ضع وقت الإغلاق أصغر من الفتح (مثال
                    من 18:00 إلى 02:00).
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
