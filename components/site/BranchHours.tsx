"use client";

import { getBranchStatus, hasStructuredHours, DAY_LABELS_AR, ARABIC_DAY_ORDER, getDayPeriods } from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

export function BranchOpenBadge({ branch }: { branch: Branch }) {
  const status = getBranchStatus(branch);

  return (
    <div
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        status.isOpen
          ? "bg-emerald-100 text-emerald-900"
          : "bg-amber-100 text-amber-950"
      }`}
      role="status"
    >
      {status.reason}
    </div>
  );
}

export function BranchWeeklyHours({ branch }: { branch: Branch }) {
  const structured = hasStructuredHours(branch.opening_hours);

  if (!structured) {
    if (branch.working_hours?.trim()) {
      return (
        <p className="text-sm text-stone-600">
          <span className="font-medium text-stone-800">ساعات العمل: </span>
          {branch.working_hours}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="mb-2 text-sm font-semibold text-stone-800">ساعات العمل</p>
      <ul className="space-y-1 text-sm text-stone-600">
        {ARABIC_DAY_ORDER.map((day) => {
          const periods = getDayPeriods(branch.opening_hours, day);
          const text =
            periods.length === 0
              ? "مغلق"
              : periods.map((p) => `${p.open} – ${p.close}`).join("، ");
          return (
            <li key={day} className="flex justify-between gap-3">
              <span className="font-medium text-stone-700">{DAY_LABELS_AR[day]}</span>
              <span dir="ltr" className="text-left">
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
