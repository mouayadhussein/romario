import Link from "next/link";
import { MapPin, Clock, Phone, ChevronLeft } from "lucide-react";
import { getBranchStatus, hasStructuredHours } from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

export function BranchCard({ branch }: { branch: Branch }) {
  const status = getBranchStatus(branch);
  const hoursHint = hasStructuredHours(branch.opening_hours)
    ? status.todayHoursText
    : branch.working_hours;

  return (
    <Link
      href={`/${branch.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgba(18,18,18,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(18,18,18,0.12)]"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-800 to-brand-900 px-5 py-7">
        <div
          className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-brand-500/15 transition duration-500 group-hover:scale-125"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-brand-500 transition group-hover:text-brand-100">
            {branch.name}
          </h2>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              status.isOpen
                ? "bg-brand-500 text-brand-900"
                : "bg-black/50 text-stone-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status.isOpen ? "bg-brand-900" : "bg-stone-400"
              }`}
            />
            {status.isOpen ? "مفتوح الآن" : "مغلق الآن"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5 text-sm text-stone-600">
        {branch.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span>{branch.address}</span>
          </p>
        )}
        {hoursHint && (
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span>{hoursHint === "مغلق" ? "اليوم مغلق" : `اليوم: ${hoursHint}`}</span>
          </p>
        )}
        {branch.phone && (
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span dir="ltr">{branch.phone}</span>
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-bold text-brand-700 transition group-hover:gap-2">
          تصفّح القائمة
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
