"use client";

import Link from "next/link";
import { ShoppingBag, ChevronLeft } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary("ar").site;

export function FloatingCartBar({ branchSlug }: { branchSlug: string }) {
  const { count, total } = useCart();

  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      <div className="pointer-events-auto mx-auto w-full max-w-3xl">
        <Link
          href={`/${branchSlug}/cart`}
          className="flex items-center gap-3 rounded-2xl bg-brand-900 px-3.5 py-3 text-white shadow-[0_12px_40px_rgba(18,18,18,0.35)] transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-brand-900">
            <ShoppingBag className="h-5 w-5" strokeWidth={2.25} />
            <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-brand-900 shadow">
              {count > 99 ? "99+" : count}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {t.cart}
              <span className="mx-1 font-normal text-white/70">·</span>
              <span className="font-semibold text-brand-500">
                {count} {count === 1 ? "صنف" : "أصناف"}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-white/65">
              اضغط لمتابعة الطلب
            </span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
            <span dir="ltr">{formatPrice(total)}</span>
            <ChevronLeft className="h-4 w-4 opacity-80" />
          </span>
        </Link>
      </div>
    </div>
  );
}
