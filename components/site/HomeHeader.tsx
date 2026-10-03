"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, Store, UtensilsCrossed, X } from "lucide-react";
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

export type HomeNavSection = "home" | "featured" | "categories" | "locations";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => {
    const ids: HomeNavSection[] = [
      "home",
      "featured",
      "categories",
      "locations",
    ];
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

  const navItems: { href: string; label: string; id: HomeNavSection }[] = [
    { href: "#home", label: "الرئيسية", id: "home" },
    { href: "#featured", label: "مميز", id: "featured" },
    { href: "#categories", label: "الأصناف", id: "categories" },
    { href: "#locations", label: "المواقع", id: "locations" },
  ];

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
    <>
      <header className="sticky top-0 z-40 overflow-x-clip px-3 pt-3 sm:px-4">
        <div
          ref={rootRef}
          className="mx-auto grid min-w-0 max-w-6xl grid-cols-1 items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-[0_10px_40px_rgba(18,18,18,0.08)] backdrop-blur sm:grid-cols-2 sm:rounded-3xl sm:gap-4 sm:p-3.5"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Mobile: hamburger opens sidebar */}
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-800 transition hover:bg-stone-200 md:hidden"
              aria-label="فتح القائمة"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            </button>

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

            {/* Desktop / tablet: inline nav */}
            <nav
              className="hidden min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto md:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="التنقل الرئيسي"
            >
              {navItems.map((item) => (
                <span key={item.id}>
                  {navLink(item.href, item.label, item.id)}
                </span>
              ))}
            </nav>

            <span
              className={cn(
                "ms-auto hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold lg:inline-flex",
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

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="إغلاق القائمة"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl animate-dropdown-in">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-black text-brand-500">
                  د
                </span>
                <span className="font-display text-base font-extrabold text-brand-900">
                  {config.appName}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700"
                aria-label="إغلاق"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="قائمة الموبايل">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-semibold transition",
                    section === item.id
                      ? "bg-brand-900 text-white"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="border-t border-stone-200 px-4 py-4 text-xs text-stone-500">
              {anyOpen ? "أحد الفروع مفتوح الآن" : "جميع الفروع مغلقة حالياً"}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
