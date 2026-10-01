import Link from "next/link";
import {
  Clock,
  MapPin,
  MessageCircle,
  Bike,
  Phone,
  ChevronLeft,
} from "lucide-react";
import { config } from "@/lib/config";
import { getBranchStatus, hasStructuredHours } from "@/lib/opening-hours";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import type { Branch } from "@/types/database";

function hoursHint(branch: Branch): string | null {
  const status = getBranchStatus(branch);
  if (hasStructuredHours(branch.opening_hours)) {
    if (!status.todayHoursText) return null;
    return status.todayHoursText === "مغلق"
      ? "اليوم مغلق"
      : status.todayHoursText;
  }
  return branch.working_hours?.trim() || null;
}

export function HomeFooter({ branches }: { branches: Branch[] }) {
  const year = new Date().getFullYear();
  const whatsappBranch =
    branches.find((b) => normalizeWhatsappNumber(b.whatsapp_number)) ?? null;
  const whatsapp = whatsappBranch
    ? normalizeWhatsappNumber(whatsappBranch.whatsapp_number)
    : null;
  const phoneBranch = branches.find((b) => b.phone?.trim()) ?? null;
  const hoursBranch =
    branches.find((b) => hoursHint(b)) ?? branches[0] ?? null;
  const hoursText = hoursBranch ? hoursHint(hoursBranch) : null;
  const addressed = branches.filter((b) => b.address?.trim()).slice(0, 3);

  return (
    <footer className="mt-10 overflow-hidden rounded-t-[1.75rem] bg-brand-900 text-white sm:mt-14 sm:rounded-t-[2rem]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-3 sm:gap-8 sm:px-6 sm:py-14">
        {/* Brand */}
        <div className="flex flex-col items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-900">
            <span className="font-display text-lg font-extrabold text-brand-500">
              {config.appName}
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-stone-300">
            مأكولات شامية وغربية، مشاوي، ومشروبات — اطلب من فرعك الأقرب بسهولة.
          </p>
          <div className="flex items-center gap-3">
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-500/40 text-brand-500 transition hover:bg-brand-500 hover:text-brand-900"
                aria-label="واتساب"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
            {phoneBranch?.phone && (
              <a
                href={`tel:${phoneBranch.phone}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-500/40 text-brand-500 transition hover:bg-brand-500 hover:text-brand-900"
                aria-label="اتصال"
              >
                <Phone className="h-5 w-5" />
              </a>
            )}
            <Link
              href="#locations"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-500/40 text-brand-500 transition hover:bg-brand-500 hover:text-brand-900"
              aria-label="مواقع الفروع"
            >
              <MapPin className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Location & contact */}
        <div>
          <h3 className="mb-4 font-display text-lg font-bold text-brand-500">
            الموقع والتواصل
          </h3>
          <ul className="space-y-3 text-sm text-stone-200">
            {addressed.length > 0 ? (
              addressed.map((b) => (
                <li key={b.id} className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span>
                    <span className="font-semibold text-white">{b.name}</span>
                    {" — "}
                    {b.address}
                  </span>
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <Link href="#locations" className="hover:text-brand-500">
                  تصفّح مواقع الفروع
                </Link>
              </li>
            )}
            {whatsapp && (
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 hover:text-brand-500"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-brand-500" />
                  اطلب عبر واتساب
                </a>
              </li>
            )}
          </ul>
        </div>

        {/* Hours */}
        <div>
          <h3 className="mb-4 font-display text-lg font-bold text-brand-500">
            ساعات العمل
          </h3>
          <ul className="space-y-3 text-sm text-stone-200">
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span dir="ltr" className="text-start">
                {hoursText ?? "راجع فرعك لأحدث المواعيد"}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bike className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span>اطلب من الفرع الأقرب إليك</span>
            </li>
            <li>
              <Link
                href="#locations"
                className="inline-flex items-center gap-1 text-brand-500 transition hover:text-brand-600"
              >
                عرض كل الفروع
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15 px-5 py-4 text-center text-xs text-stone-400 sm:px-6">
        Copyright © {year} {config.appName}. جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
