"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Store, UtensilsCrossed, X } from "lucide-react";
import { config } from "@/lib/config";
import { cn, formatPrice } from "@/lib/utils";

export type HomeCategoryBranch = {
  id: string;
  name: string;
  slug: string;
};

export type HomeSearchCategory = {
  name: string;
  imageUrl: string | null;
  branches: HomeCategoryBranch[];
};

export type HomeSearchItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string;
  branchId: string;
  branchName: string;
  branchSlug: string;
};

export type HomeNavSection = "home" | "categories" | "locations";

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function HomeHeader({
  anyOpen,
  categories,
  items,
  activeSection = "home",
}: {
  anyOpen: boolean;
  categories: HomeSearchCategory[];
  items: HomeSearchItem[];
  activeSection?: HomeNavSection;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<HomeNavSection>(activeSection);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < 1) {
      return {
        categories: [] as HomeSearchCategory[],
        items: [] as HomeSearchItem[],
      };
    }
    const matchedCategories = categories
      .filter((c) => normalize(c.name).includes(q))
      .slice(0, 6);
    const matchedItems = items
      .filter(
        (i) =>
          normalize(i.name).includes(q) ||
          normalize(i.description ?? "").includes(q) ||
          normalize(i.categoryName).includes(q) ||
          normalize(i.branchName).includes(q)
      )
      .slice(0, 8);
    return { categories: matchedCategories, items: matchedItems };
  }, [query, categories, items]);

  const hasResults =
    results.categories.length > 0 || results.items.length > 0;
  const showPanel = open && normalize(query).length > 0;

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const ids: HomeNavSection[] = ["home", "categories", "locations"];
    const elements = ids
      .map((id) => ({ id, el: document.getElementById(id) }))
      .filter((x): x is { id: HomeNavSection; el: HTMLElement } => !!x.el);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target?.id) return;
        const id = visible.target.id as HomeNavSection;
        if (ids.includes(id)) setSection(id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
    );

    for (const { el } of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const navLink = (href: string, label: string, id: HomeNavSection) => (
    <a
      href={href}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition sm:px-4",
        section === id
          ? "bg-brand-900 text-white"
          : "text-stone-700 hover:bg-stone-100"
      )}
    >
      {label}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        ref={rootRef}
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-[0_10px_40px_rgba(18,18,18,0.08)] backdrop-blur sm:grid-cols-2 sm:rounded-3xl sm:gap-4 sm:p-3.5"
      >
        {/* Right half in RTL (first column): logo + nav */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/#home"
            className="flex shrink-0 items-center gap-2 rounded-full bg-brand-500 px-2.5 py-1.5 text-brand-900 sm:px-3 sm:py-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 text-sm font-black text-brand-500">
              د
            </span>
            <span className="hidden font-display text-sm font-extrabold md:inline">
              {config.appName}
            </span>
          </Link>

          <nav
            className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="التنقل الرئيسي"
          >
            {navLink("#home", "الرئيسية", "home")}
            {navLink("#categories", "الأصناف", "categories")}
            {navLink("#locations", "المواقع", "locations")}
          </nav>

          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold lg:inline-flex",
              anyOpen
                ? "bg-emerald-50 text-emerald-800"
                : "bg-stone-100 text-stone-600"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                anyOpen ? "bg-emerald-500" : "bg-stone-400"
              )}
            />
            {anyOpen ? "مفتوح" : "مغلق"}
          </span>
        </div>

        {/* Left half in RTL (second column): full-width search */}
        <div className="relative min-w-0 w-full">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="ابحث عن وجبة أو صنف..."
            className="w-full rounded-full border-0 bg-stone-100 py-2.5 pr-10 pl-10 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label="بحث في الوجبات والأصناف"
          />
          {query && (
            <button
              type="button"
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full p-0.5 text-stone-400 hover:text-stone-700"
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
              aria-label="مسح البحث"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showPanel && (
            <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
              {!hasResults ? (
                <p className="px-2 py-4 text-center text-sm text-stone-500">
                  لا توجد نتائج لـ «{query}»
                </p>
              ) : (
                <div className="space-y-4">
                  {results.categories.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold text-stone-500">
                        <Store className="h-3.5 w-3.5" />
                        الأصناف
                      </p>
                      <ul className="space-y-1">
                        {results.categories.map((cat) => (
                          <li key={cat.name}>
                            <a
                              href="#categories"
                              onClick={() => {
                                setOpen(false);
                                setQuery("");
                              }}
                              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-50"
                            >
                              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-brand-100">
                                {cat.imageUrl ? (
                                  <Image
                                    src={cat.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-brand-600">
                                    <Store className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-stone-900">
                                  {cat.name}
                                </p>
                                <p className="text-xs text-stone-500">
                                  متوفر في {cat.branches.length} فرع
                                </p>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {results.items.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold text-stone-500">
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        الوجبات
                      </p>
                      <ul className="space-y-1">
                        {results.items.map((item) => (
                          <li key={`${item.branchId}-${item.id}`}>
                            <Link
                              href={`/${item.branchSlug}`}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-50"
                            >
                              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-stone-100">
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-stone-400">
                                    <UtensilsCrossed className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-stone-900">
                                  {item.name}
                                </p>
                                <p className="truncate text-xs text-stone-500">
                                  {item.categoryName} · {item.branchName}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-bold text-brand-700">
                                {formatPrice(item.price)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
