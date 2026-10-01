"use client";

import { useMemo, useState } from "react";
import { MapPin, Phone, ExternalLink, MessageCircle } from "lucide-react";
import { CategoryTabs } from "./CategoryTabs";
import { SearchBar } from "./SearchBar";
import { ItemCard } from "./ItemCard";
import { BranchOpenBadge, BranchWeeklyHours } from "./BranchHours";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDictionary } from "@/lib/i18n";
import { getBranchStatus } from "@/lib/opening-hours";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
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
  const status = useMemo(() => getBranchStatus(branch), [branch]);
  const orderingDisabled = !status.isOpen;

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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold leading-tight text-stone-900">
            {branch.name}
          </h1>
          <BranchOpenBadge branch={branch} compact />
        </div>

        {(branch.address || branch.phone) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
            {branch.address && (
              <p className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span className="truncate">{branch.address}</span>
              </p>
            )}
            {branch.phone && (
              <a
                href={`tel:${branch.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-brand-700"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span dir="ltr">{branch.phone}</span>
              </a>
            )}
          </div>
        )}

        <div className="mt-2">
          <BranchWeeklyHours branch={branch} compact />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {normalizeWhatsappNumber(branch.whatsapp_number) && (
            <a
              href={`https://wa.me/${normalizeWhatsappNumber(branch.whatsapp_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-[11px] font-medium text-green-800 hover:bg-green-200"
            >
              <MessageCircle className="h-3 w-3" />
              {t.whatsapp}
            </a>
          )}
          {branch.map_url && (
            <a
              href={branch.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-200"
            >
              <ExternalLink className="h-3 w-3" />
              {t.map}
            </a>
          )}
        </div>
      </section>

      {orderingDisabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          الفرع مغلق حالياً. يمكنك تصفّح القائمة، لكن لا يمكن إضافة وجبات أو إرسال
          طلب حتى يفتح الفرع.
          {status.reason ? ` (${status.reason})` : null}
        </div>
      )}

      <SearchBar value={query} onChange={setQuery} placeholder={t.searchMenu} />

      <CategoryTabs
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        activeId={activeCategory}
        onChange={setActiveCategory}
      />

      {filtered.length === 0 ? (
        <EmptyState title={t.noResults || "لا توجد أصناف"} />
      ) : (
        <div className="space-y-6">
          {filtered.map((cat) => (
            <section key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="mb-3 text-lg font-bold text-stone-800">{cat.name}</h2>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    orderingDisabled={orderingDisabled}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
