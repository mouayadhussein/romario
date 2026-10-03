"use client";

import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { config } from "@/lib/config";
import { formatPrice } from "@/lib/utils";

export function SiteHeader({
  branchName,
  branchSlug,
  showBack,
  showCart = false,
}: {
  branchName?: string;
  branchSlug?: string;
  showBack?: boolean;
  showCart?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {showBack && (
            <Link
              href={branchSlug ? `/${branchSlug}` : "/"}
              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
              aria-label="رجوع"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <Link href="/" className="block truncate text-sm font-bold text-brand-700">
              {config.appName}
            </Link>
            {branchName && (
              <p className="truncate text-xs text-stone-500">{branchName}</p>
            )}
          </div>
        </div>
        {showCart && branchSlug && <CartButton branchSlug={branchSlug} />}
      </div>
    </header>
  );
}

function CartButton({ branchSlug }: { branchSlug: string }) {
  const { count, total } = useCart();
  return (
    <Link
      href={`/${branchSlug}/cart`}
      className="relative inline-flex items-center gap-2 rounded-full bg-brand-900 px-2.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-800"
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-brand-900">
        <ShoppingBag className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-900">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="hidden pe-1 sm:inline">
        {count > 0 ? formatPrice(total) : "السلة"}
      </span>
    </Link>
  );
}
