"use client";

import { Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ARABIC_DAY_ORDER,
  DAY_LABELS_AR,
  type DayKey,
  type OpeningHours,
  type TimeRange,
} from "@/lib/opening-hours";

function periodsFor(hours: OpeningHours, day: DayKey): TimeRange[] {
  return hours[day] ?? [];
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
      next[day] = [{ open: "09:00", close: "22:00" }];
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
      <p className="text-sm font-medium text-stone-800">ساعات العمل الأسبوعية</p>
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
                      <Input
                        label={index === 0 ? "فتح" : undefined}
                        type="time"
                        dir="ltr"
                        value={period.open}
                        onChange={(e) =>
                          updatePeriod(day, index, { open: e.target.value })
                        }
                        className="w-32"
                      />
                      <Input
                        label={index === 0 ? "إغلاق" : undefined}
                        type="time"
                        dir="ltr"
                        value={period.close}
                        onChange={(e) =>
                          updatePeriod(day, index, { close: e.target.value })
                        }
                        className="w-32"
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
                    18:00 → 02:00).
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
