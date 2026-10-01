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
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">{branch.name}</h1>
        <div className="mt-3">
          <BranchOpenBadge branch={branch} />
        </div>
        <div className="mt-3 space-y-2 text-sm text-stone-600">
          {branch.address && (
            <p className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {branch.address}
            </p>
          )}
          {branch.phone && (
            <a href={`tel:${branch.phone}`} className="flex gap-2 hover:text-brand-700">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span dir="ltr">{branch.phone}</span>
            </a>
          )}
        </div>
        <div className="mt-3">
          <BranchWeeklyHours branch={branch} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {branch.map_url && (
            <a
              href={branch.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.map}
            </a>
          )}
          {normalizeWhatsappNumber(branch.whatsapp_number) && (
            <a
              href={`https://wa.me/${normalizeWhatsappNumber(branch.whatsapp_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-200"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {t.whatsapp}
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
