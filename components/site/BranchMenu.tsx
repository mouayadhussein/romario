"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlignJustify, LayoutGrid, Rows3 } from "lucide-react";
import { BranchHero } from "./BranchHero";
import { CategoryTabs } from "./CategoryTabs";
import { SearchBar } from "./SearchBar";
import { ItemCard, type ItemViewMode } from "./ItemCard";
import { FloatingCartBar } from "./FloatingCartBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDictionary } from "@/lib/i18n";
import { getBranchStatus } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import type { Branch, CategoryWithItems } from "@/types/database";

const t = getDictionary("ar").site;

export function BranchMenu({
  branch,
  categories,
}: {
  branch: Branch;
  categories: CategoryWithItems[];
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ItemViewMode>("cards");

  const status = useMemo(() => getBranchStatus(branch), [branch]);
  const orderingDisabled = !status.isOpen;

  const cuisineLine = useMemo(
    () => categories.map((c) => c.name).filter(Boolean).slice(0, 5).join("، "),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => (activeCategory ? c.id === activeCategory : true))
      .map((c) => ({
        ...c,
        items: c.items.filter((item) => {
          if (!q) return true;
          return (
            item.name.toLowerCase().includes(q) ||
            (item.description?.toLowerCase().includes(q) ?? false)
          );
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, activeCategory, query]);

  const activeCatMeta = useMemo(() => {
    if (activeCategory) {
      const cat = categories.find((c) => c.id === activeCategory);
      if (cat) {
        const count =
          filtered.find((c) => c.id === cat.id)?.items.length ?? cat.items.length;
        return { name: cat.name, count, image_url: cat.image_url };
      }
    }
    const count = filtered.reduce((sum, c) => sum + c.items.length, 0);
    return { name: "القائمة", count, image_url: null as string | null };
  }, [activeCategory, categories, filtered]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-[#f3f3f3]">
      <BranchHero branch={branch} cuisineLine={cuisineLine || undefined} />

      <CategoryTabs
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          image_url: c.image_url,
        }))}
        activeId={activeCategory}
        onChange={setActiveCategory}
      />

      <FloatingCartBar branchSlug={branch.slug} />

      <div className="mx-auto min-w-0 max-w-3xl px-3 pb-28 pt-3 sm:px-6 sm:pt-4">
        {orderingDisabled && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            الفرع مغلق حالياً. يمكنك تصفّح القائمة، لكن لا يمكن إضافة وجبات أو إرسال
            طلب حتى يفتح الفرع.
            {status.reason ? ` (${status.reason})` : null}
          </div>
        )}

        <div className="mb-3">
          <SearchBar value={query} onChange={setQuery} placeholder={t.searchMenu} />
        </div>

        {/* Section header: title+count (RTL start/right) · view toggles (left) */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-stone-900 sm:text-lg">
              {activeCatMeta.name}
              <span className="ms-1.5 font-semibold text-stone-400">
                ({activeCatMeta.count})
              </span>
            </h2>
          </div>

          <div
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm"
            role="group"
            aria-label="طريقة العرض"
          >
            <ViewToggle
              label="عرض بطاقات"
              active={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            >
              <AlignJustify className="h-4 w-4" />
            </ViewToggle>
            <ViewToggle
              label="عرض قائمة"
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <Rows3 className="h-4 w-4" />
            </ViewToggle>
            <ViewToggle
              label="عرض شبكة"
              active={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </ViewToggle>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t.noResults || "لا توجد أصناف"} />
        ) : (
          <div className="space-y-7">
            {filtered.map((cat) => (
              <section key={cat.id} id={`cat-${cat.id}`}>
                {activeCategory === null && (
                  <h3 className="mb-3 text-base font-bold text-stone-800 sm:text-lg">
                    {cat.name}
                    <span className="ms-1.5 text-sm font-semibold text-stone-400">
                      ({cat.items.length})
                    </span>
                  </h3>
                )}
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3"
                      : "space-y-3 sm:space-y-4"
                  )}
                >
                  {cat.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      orderingDisabled={orderingDisabled}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition",
        active
          ? "bg-stone-900 text-white"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      )}
    >
      {children}
    </button>
  );
}
