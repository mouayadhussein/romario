"use client";

import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { config } from "@/lib/config";

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
  const { count } = useCart();
  return (
    <Link
      href={`/${branchSlug}/cart`}
      className="relative inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
    >
      <ShoppingBag className="h-4 w-4" />
      <span>السلة</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-brand-900">
          {count}
        </span>
      )}
    </Link>
  );
}
