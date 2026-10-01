import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
} from "lucide-react";
import { getBranchStatus, hasStructuredHours } from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

export function HomeLocations({ branches }: { branches: Branch[] }) {
  if (branches.length === 0) return null;

  return (
    <section
      id="locations"
      className="scroll-mt-28 border-t border-stone-200/70 bg-white/60 px-4 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="inline-flex rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-brand-500">
            المواقع
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-brand-900 sm:text-4xl">
            مواقع الفروع
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const status = getBranchStatus(branch);
            const hoursHint = hasStructuredHours(branch.opening_hours)
              ? status.todayHoursText
              : branch.working_hours;

            return (
              <article
                key={branch.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_30px_rgba(18,18,18,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(18,18,18,0.12)]"
              >
                <Link
                  href={`/${branch.slug}`}
                  className="absolute inset-0 z-0"
                  aria-label={`عرض ${branch.name}`}
                />

                <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
                  <div className="relative overflow-hidden bg-gradient-to-br from-brand-800 to-brand-900 px-5 py-6">
                    <div className="relative flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl font-bold text-brand-500">
                        {branch.name}
                      </h3>
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
                    {branch.address ? (
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <span>{branch.address}</span>
                      </p>
                    ) : (
                      <p className="flex items-start gap-2 text-stone-400">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>لم يُضف عنوان لهذا الفرع بعد</span>
                      </p>
                    )}

                    {hoursHint && (
                      <p className="flex items-start gap-2">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <span>
                          {hoursHint === "مغلق"
                            ? "اليوم مغلق"
                            : `اليوم: ${hoursHint}`}
                        </span>
                      </p>
                    )}

                    {branch.phone && (
                      <a
                        href={`tel:${branch.phone}`}
                        className="pointer-events-auto relative z-20 flex items-start gap-2 hover:text-brand-700"
                      >
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <span dir="ltr">{branch.phone}</span>
                      </a>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      {branch.map_url && (
                        <a
                          href={branch.map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pointer-events-auto relative z-20 inline-flex items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1.5 text-xs font-bold text-brand-500 hover:bg-brand-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          موقع الفرع على الخريطة
                        </a>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-brand-900 transition group-hover:bg-brand-600 group-hover:text-white">
                        عرض
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
