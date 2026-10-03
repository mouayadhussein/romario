"use client";

import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type CategoryTab = {
  id: string;
  name: string;
  image_url?: string | null;
};

interface CategoryTabsProps {
  categories: CategoryTab[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

export function CategoryTabs({ categories, activeId, onChange }: CategoryTabsProps) {
  return (
    <div className="sticky top-0 z-20 overflow-x-clip border-b border-stone-200 bg-white/95 backdrop-blur">
      <div
        className="mx-auto max-w-3xl overflow-x-auto overscroll-x-contain px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="flex w-max max-w-none items-stretch gap-1 py-0"
          role="tablist"
          aria-label="التصنيفات"
        >
          <CategoryTabButton
            label="الكل"
            selected={activeId === null}
            onClick={() => onChange(null)}
          />
          {categories.map((cat) => (
            <CategoryTabButton
              key={cat.id}
              label={cat.name}
              imageUrl={cat.image_url}
              selected={activeId === cat.id}
              onClick={() => onChange(cat.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryTabButton({
  label,
  imageUrl,
  selected,
  onClick,
}: {
  label: string;
  imageUrl?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition sm:px-4",
        selected ? "text-stone-900" : "text-stone-500 hover:text-stone-800"
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 sm:h-8 sm:w-8",
          selected && "ring-2 ring-brand-500/40"
        )}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="32px" />
        ) : (
          <LayoutGrid className="h-3.5 w-3.5 text-stone-500" />
        )}
      </span>
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={cn(
          "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition",
          selected ? "bg-brand-600" : "bg-transparent"
        )}
        aria-hidden
      />
    </button>
  );
}
