import Link from "next/link";
import { MapPin, Clock, Phone } from "lucide-react";
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
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="bg-gradient-to-br from-brand-800 to-brand-900 px-5 py-8">
        <h2 className="text-xl font-bold text-brand-500">{branch.name}</h2>
        <p
          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            status.isOpen
              ? "bg-brand-500/20 text-brand-100"
              : "bg-black/40 text-stone-300"
          }`}
        >
          {status.isOpen ? "مفتوح الآن" : "مغلق الآن"}
        </p>
      </div>
      <div className="space-y-2 p-5 text-sm text-stone-600">
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
      </div>
    </Link>
  );
}
