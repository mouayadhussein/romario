"use client";

import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: { id: string; name: string }[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

export function CategoryTabs({ categories, activeId, onChange }: CategoryTabsProps) {
  return (
    <div className="sticky top-14 z-20 -mx-4 overflow-x-auto border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2">
      <div className="flex gap-1 py-2" role="tablist" aria-label="التصنيفات">
        <button
          type="button"
          role="tab"
          aria-selected={activeId === null}
          onClick={() => onChange(null)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            activeId === null
              ? "bg-brand-600 text-white"
              : "bg-brand-900 text-brand-500 hover:bg-brand-800"
          )}
        >
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeId === cat.id}
            onClick={() => onChange(cat.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              activeId === cat.id
                ? "bg-brand-600 text-white"
                : "bg-brand-900 text-brand-500 hover:bg-brand-800"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
