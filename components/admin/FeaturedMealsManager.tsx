"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Save, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveFeaturedMealsAction } from "@/lib/admin-actions";
import {
  DEFAULT_FEATURED_COUNT,
  MAX_FEATURED_COUNT,
  pickDefaultItemIds,
  type FeaturedSettings,
} from "@/lib/featured-items";
import { formatPrice, cn } from "@/lib/utils";

export type AdminMealOption = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryName: string;
  branchName: string;
  branchSlug: string;
};

export function FeaturedMealsManager({
  initialSettings,
  meals,
}: {
  initialSettings: FeaturedSettings;
  meals: AdminMealOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(
    initialSettings.display_count || DEFAULT_FEATURED_COUNT
  );
  const [selected, setSelected] = useState<string[]>(() => {
    if (initialSettings.item_ids.length > 0) return initialSettings.item_ids;
    return pickDefaultItemIds(meals, DEFAULT_FEATURED_COUNT);
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.categoryName.toLowerCase().includes(q) ||
        m.branchName.toLowerCase().includes(q)
    );
  }, [meals, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function move(id: string, dir: -1 | 1) {
    setSelected((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveFeaturedMealsAction({
        display_count: displayCount,
        item_ids: selected,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("تم حفظ الوجبات المميزة");
    });
  }

  const previewIds = selected.slice(0, displayCount);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
        <h1 className="text-lg font-bold text-stone-900">الوجبات المميزة</h1>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">
          اختر الوجبات التي تظهر في الصفحة الرئيسية بين الصورة العلوية وقسم
          الفروع. العدد يحدد كم صورة تُعرض للزبون.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-stone-600">
              عدد الصور المعروضة
            </span>
            <input
              type="number"
              min={0}
              max={MAX_FEATURED_COUNT}
              value={displayCount}
              onChange={(e) =>
                setDisplayCount(
                  Math.min(
                    MAX_FEATURED_COUNT,
                    Math.max(0, Number(e.target.value) || 0)
                  )
                )
              }
              className="w-full max-w-[8rem] rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <div className="flex min-w-0 flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={pending}>
              <Save className="h-4 w-4" />
              {pending ? "جاري الحفظ..." : "حفظ"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                setSelected(
                  pickDefaultItemIds(meals, displayCount || DEFAULT_FEATURED_COUNT)
                )
              }
            >
              اختيار عشوائي ({displayCount || DEFAULT_FEATURED_COUNT})
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-stone-500">
          محدد حالياً: {selected.length} · سيُعرض: {previewIds.length}
        </p>
      </div>

      {previewIds.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-bold text-stone-800">ترتيب العرض</h2>
          <ul className="space-y-2">
            {previewIds.map((id, index) => {
              const meal = meals.find((m) => m.id === id);
              if (!meal) return null;
              return (
                <li
                  key={id}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-2 py-2 sm:gap-3 sm:px-3"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-stone-400 sm:w-6">
                    {index + 1}
                  </span>
                  <Thumb url={meal.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {meal.name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {meal.branchName} · {meal.categoryName}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-white"
                      onClick={() => move(id, -1)}
                      aria-label="تحريك للأعلى"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-white"
                      onClick={() => move(id, 1)}
                      aria-label="تحريك للأسفل"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الوجبة أو الفرع..."
            className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pr-10 pl-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <ul className="divide-y divide-stone-100">
          {filtered.map((meal) => {
            const checked = selectedSet.has(meal.id);
            return (
              <li key={meal.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-1 py-2.5 transition hover:bg-stone-50",
                    checked && "bg-brand-50/60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(meal.id)}
                    className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  <Thumb url={meal.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {meal.name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {meal.branchName} · {meal.categoryName}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-brand-700">
                    {formatPrice(meal.price)}
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-stone-500">
              لا توجد وجبات مطابقة
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
      {url ? (
        <Image src={url} alt="" fill className="object-cover" sizes="44px" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
          —
        </span>
      )}
    </div>
  );
}
