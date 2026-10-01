"use client";

import { useId, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import {
  getBranchStatus,
  hasStructuredHours,
  DAY_LABELS_AR,
  ARABIC_DAY_ORDER,
  getDayPeriods,
} from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

export function BranchOpenBadge({
  branch,
  compact = false,
}: {
  branch: Branch;
  compact?: boolean;
}) {
  const status = getBranchStatus(branch);
  const label = compact
    ? status.isOpen
      ? "مفتوح"
      : "مغلق"
    : status.reason;

  return (
    <div
      className={
        compact
          ? `inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              status.isOpen
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-950"
            }`
          : `rounded-xl px-3 py-2 text-sm font-semibold ${
              status.isOpen
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-950"
            }`
      }
      role="status"
      title={status.reason}
    >
      {compact && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status.isOpen ? "bg-emerald-600" : "bg-amber-600"
          }`}
        />
      )}
      {label}
    </div>
  );
}

export function BranchWeeklyHours({
  branch,
  compact = false,
}: {
  branch: Branch;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const structured = hasStructuredHours(branch.opening_hours);
  const status = getBranchStatus(branch);

  if (!structured) {
    if (!branch.working_hours?.trim()) return null;

    return (
      <div
        className={`overflow-hidden border border-stone-200 bg-stone-50 ${
          compact ? "rounded-lg" : "rounded-xl"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex w-full items-center justify-between gap-2 text-stone-800 transition hover:bg-stone-100 ${
            compact
              ? "px-2.5 py-1.5 text-xs font-medium"
              : "px-3 py-2.5 text-sm font-semibold"
          }`}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Clock
              className={`shrink-0 text-brand-600 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
            />
            <span>ساعات العمل</span>
            {compact && branch.working_hours && !open && (
              <span className="truncate font-normal text-stone-500">
                · {branch.working_hours}
              </span>
            )}
          </span>
          <ChevronDown
            className={`shrink-0 text-stone-500 transition-transform duration-200 ${
              compact ? "h-3.5 w-3.5" : "h-4 w-4"
            } ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div
          id={panelId}
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <p
              className={`border-t border-stone-200 text-stone-600 ${
                compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-sm"
              }`}
            >
              {branch.working_hours}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const todayHint =
    status.todayHoursText === "مغلق"
      ? "اليوم مغلق"
      : status.todayHoursText
        ? `اليوم ${status.todayHoursText}`
        : null;

  return (
    <div
      className={`overflow-hidden border border-stone-200 bg-stone-50 ${
        compact ? "rounded-lg" : "rounded-xl"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between gap-2 text-stone-800 transition hover:bg-stone-100 ${
          compact
            ? "px-2.5 py-1.5 text-xs font-medium"
            : "px-3 py-2.5 text-sm font-semibold"
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Clock
            className={`shrink-0 text-brand-600 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
          />
          <span>ساعات العمل</span>
          {compact && todayHint && !open && (
            <span className="truncate font-normal text-stone-500">
              · {todayHint}
            </span>
          )}
        </span>
        <ChevronDown
          className={`shrink-0 text-stone-500 transition-transform duration-200 ${
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          } ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul
            className={`border-t border-stone-200 text-stone-600 ${
              compact
                ? "space-y-0.5 px-2.5 py-1.5 text-xs"
                : "space-y-1 px-3 py-2.5 text-sm"
            }`}
          >
            {ARABIC_DAY_ORDER.map((day) => {
              const periods = getDayPeriods(branch.opening_hours, day);
              const text =
                periods.length === 0
                  ? "مغلق"
                  : periods.map((p) => `${p.open} – ${p.close}`).join("، ");
              return (
                <li key={day} className="flex justify-between gap-3">
                  <span className="font-medium text-stone-700">
                    {DAY_LABELS_AR[day]}
                  </span>
                  <span dir="ltr" className="text-left">
                    {text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
