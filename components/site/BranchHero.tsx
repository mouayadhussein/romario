"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Menu,
  Globe,
  Phone,
  MapPin,
  Clock,
  ShoppingBag,
  Globe2,
  MessageCircle,
  X,
  Home,
} from "lucide-react";
import { config } from "@/lib/config";
import { useCart } from "@/lib/cart";
import { getBranchStatus } from "@/lib/opening-hours";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { Branch } from "@/types/database";

export function BranchHero({
  branch,
  cuisineLine,
}: {
  branch: Branch;
  cuisineLine?: string;
}) {
  const status = getBranchStatus(branch);
  const { count } = useCart();
  const wa = normalizeWhatsappNumber(branch.whatsapp_number);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hoursLabel = status.isOpen
    ? status.todayHoursText && status.todayHoursText !== "مغلق"
      ? status.todayHoursText
      : "مفتوح"
    : "مغلق";

  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  return (
    <>
      <header className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-banner.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 960px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-linear-to-b from-black/55 via-black/65 to-black/80"
            aria-hidden
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-3.5 pt-2.5 sm:px-6 sm:pb-4 sm:pt-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
              aria-label="تغيير اللغة"
            >
              <span>English</span>
              <Globe className="h-4 w-4 opacity-90" />
            </button>

            <div className="flex items-center gap-1.5">
              <Link
                href={`/${branch.slug}/cart`}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/95 transition hover:bg-white/10"
                aria-label="السلة"
              >
                <ShoppingBag className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-brand-900">
                    {count}
                  </span>
                )}
              </Link>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/95 transition hover:bg-white/10"
                aria-label="فتح القائمة"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center text-center sm:mt-3.5">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-white shadow-lg sm:h-16 sm:w-16">
              <span className="font-display text-xl font-extrabold text-brand-600 sm:text-2xl">
                {config.appName.slice(0, 1)}
              </span>
            </div>

            <h1 className="mt-2 font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {branch.name}
            </h1>

            {cuisineLine ? (
              <p className="mt-1 max-w-md truncate text-xs text-white/75 sm:text-sm">
                {cuisineLine}
              </p>
            ) : null}

            <div className="mt-2 flex max-w-lg flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/85 sm:text-xs">
              {branch.phone && (
                <a
                  href={`tel:${branch.phone}`}
                  className="inline-flex items-center gap-1 transition hover:text-white"
                >
                  <Phone className="h-3 w-3 shrink-0 opacity-90" />
                  <span dir="ltr">{branch.phone}</span>
                </a>
              )}
              {branch.address && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0 opacity-90" />
                  <span className="max-w-32 truncate sm:max-w-44">
                    {branch.address}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 opacity-90" />
                <span>{hoursLabel}</span>
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
              {branch.map_url && (
                <SocialCircle href={branch.map_url} label="الموقع">
                  <Globe2 className="h-3.5 w-3.5" />
                </SocialCircle>
              )}
              <SocialCircle label="يوتيوب" disabled>
                <SocialGlyph>
                  <path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.7 4.8 12 4.8 12 4.8s-6.7 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.2 12a29 29 0 0 0 .3 4.8 2.8 2.8 0 0 0 2 2c1.8.4 8.5.4 8.5.4s6.7 0 8.5-.4a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .3-4.8 29 29 0 0 0-.3-4.8ZM10 15.2V8.8L15.8 12 10 15.2Z" />
                </SocialGlyph>
              </SocialCircle>
              <SocialCircle label="إنستغرام" disabled>
                <SocialGlyph>
                  <path d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 1.7A3.3 3.3 0 0 0 4.7 8v8A3.3 3.3 0 0 0 8 19.3h8A3.3 3.3 0 0 0 19.3 16V8A3.3 3.3 0 0 0 16 4.7H8Zm8.9 1.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7.4A4.6 4.6 0 1 1 12 16.6 4.6 4.6 0 0 1 12 7.4Zm0 1.7a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" />
                </SocialGlyph>
              </SocialCircle>
              {wa && (
                <SocialCircle
                  href={`https://wa.me/${wa}`}
                  label="واتساب"
                  className="bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </SocialCircle>
              )}
            </div>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="إغلاق القائمة"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white text-stone-900 shadow-2xl animate-dropdown-in">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-extrabold text-brand-900">
                  {branch.name}
                </p>
                <p className="text-xs text-stone-500">{config.appName}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"
                aria-label="إغلاق"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-3">
              <SideLink href="/" onClick={() => setSidebarOpen(false)}>
                <Home className="h-4 w-4" />
                الرئيسية
              </SideLink>
              <SideLink
                href={`/${branch.slug}/cart`}
                onClick={() => setSidebarOpen(false)}
              >
                <ShoppingBag className="h-4 w-4" />
                السلة{count > 0 ? ` (${count})` : ""}
              </SideLink>
              {branch.phone && (
                <a
                  href={`tel:${branch.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Phone className="h-4 w-4" />
                  اتصال
                </a>
              )}
              {wa && (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MessageCircle className="h-4 w-4" />
                  واتساب
                </a>
              )}
              {branch.map_url && (
                <a
                  href={branch.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MapPin className="h-4 w-4" />
                  الموقع على الخريطة
                </a>
              )}
            </nav>

            <div
              className={cn(
                "border-t border-stone-200 px-4 py-3 text-xs font-semibold",
                status.isOpen ? "text-emerald-700" : "text-amber-800"
              )}
            >
              {status.isOpen ? `مفتوح · ${hoursLabel}` : `مغلق · ${status.reason}`}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function SideLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
    >
      {children}
    </Link>
  );
}

function SocialCircle({
  href,
  label,
  children,
  disabled,
  className = "bg-white text-stone-800 hover:bg-stone-100",
}: {
  href?: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition sm:h-9 sm:w-9";

  if (disabled || !href) {
    return (
      <span
        className={`${base} ${className} opacity-70`}
        aria-label={label}
        title={label}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );
}

function SocialGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 fill-current"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}
