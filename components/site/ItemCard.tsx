"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import type { Item } from "@/types/database";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary("ar").site;

export type ItemViewMode = "cards" | "list" | "grid";

export function ItemCard({
  item,
  orderingDisabled = false,
  viewMode = "cards",
}: {
  item: Item;
  orderingDisabled?: boolean;
  viewMode?: ItemViewMode;
}) {
  const { addItem } = useCart();
  const unavailable = !item.is_available;
  const disabled = unavailable || orderingDisabled;

  function handleAdd() {
    if (disabled) return;
    addItem({
      itemId: item.id,
      name: item.name,
      price: Number(item.price),
      imageUrl: item.image_url,
    });
    toast.success(`تمت إضافة ${item.name}`);
  }

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          "flex gap-3 overflow-hidden rounded-xl border border-stone-200 bg-white p-3 shadow-sm",
          disabled && "opacity-60"
        )}
      >
        <Thumb imageUrl={item.image_url} name={item.name} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-stone-900">{item.name}</h3>
            <span className="shrink-0 text-sm font-bold text-brand-700">
              {formatPrice(Number(item.price))}
            </span>
          </div>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
              {item.description}
            </p>
          )}
          <div className="mt-auto pt-2">
            <StatusOrAdd
              unavailable={unavailable}
              orderingDisabled={orderingDisabled}
              onAdd={handleAdd}
              compact
            />
          </div>
        </div>
      </article>
    );
  }

  if (viewMode === "grid") {
    return (
      <article
        className={cn(
          "overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm",
          disabled && "opacity-60"
        )}
      >
        <div className="relative aspect-4/3 bg-stone-100">
          <ItemImage imageUrl={item.image_url} name={item.name} />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/35 to-transparent px-2.5 pb-2.5 pt-10">
            <div className="flex items-end justify-between gap-2">
              <h3 className="min-w-0 text-start text-sm font-bold leading-snug text-white drop-shadow">
                {item.name}
              </h3>
              <PricePill price={Number(item.price)} />
            </div>
          </div>
          {!disabled && (
            <AddFab onClick={handleAdd} className="absolute top-2 left-2" />
          )}
        </div>
        {item.description && (
          <p className="line-clamp-2 px-2.5 py-2 text-[11px] leading-relaxed text-stone-500">
            {item.description}
          </p>
        )}
        {(unavailable || orderingDisabled) && (
          <div className="px-2.5 pb-2">
            <StatusOrAdd
              unavailable={unavailable}
              orderingDisabled={orderingDisabled}
              onAdd={handleAdd}
              compact
            />
          </div>
        )}
      </article>
    );
  }

  /* Default: large cards — matches reference structure */
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
        disabled && "opacity-60"
      )}
    >
      <div className="relative aspect-16/10 bg-stone-100 sm:aspect-video">
        <ItemImage imageUrl={item.image_url} name={item.name} priority={false} />
        <div
          className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent"
          aria-hidden
        />

        {!unavailable && (
          <span className="absolute top-3 right-3 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm sm:text-xs">
            متاح
          </span>
        )}
        {unavailable && (
          <span className="absolute top-3 right-3 rounded-md bg-stone-900/70 px-2 py-0.5 text-[10px] font-medium text-white sm:text-xs">
            {t.unavailable}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
          <h3 className="min-w-0 flex-1 text-start font-display text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-xl">
            {item.name}
          </h3>
          <PricePill price={Number(item.price)} large />
        </div>

        {!disabled && (
          <AddFab onClick={handleAdd} className="absolute top-3 left-3" />
        )}
      </div>

      {item.description && (
        <p className="px-3 py-2.5 text-start text-xs leading-relaxed text-stone-500 sm:px-4 sm:py-3 sm:text-sm">
          {item.description}
        </p>
      )}

      {(unavailable || orderingDisabled) && (
        <div className="border-t border-stone-100 px-3 py-2 sm:px-4">
          <StatusOrAdd
            unavailable={unavailable}
            orderingDisabled={orderingDisabled}
            onAdd={handleAdd}
            compact
          />
        </div>
      )}
    </article>
  );
}

function ItemImage({
  imageUrl,
  name,
  priority = false,
}: {
  imageUrl: string | null;
  name: string;
  priority?: boolean;
}) {
  if (!imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-stone-400">
        بدون صورة
      </div>
    );
  }
  return (
    <Image
      src={imageUrl}
      alt={name}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, 720px"
      priority={priority}
    />
  );
}

function Thumb({
  imageUrl,
  name,
  size = "sm",
}: {
  imageUrl: string | null;
  name: string;
  size?: "sm";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-stone-100",
        size === "sm" && "h-24 w-24"
      )}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill className="object-cover" sizes="96px" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
          بدون صورة
        </div>
      )}
    </div>
  );
}

function PricePill({ price, large }: { price: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-black/80 font-bold text-white backdrop-blur-sm",
        large
          ? "px-3 py-1 text-xs sm:px-3.5 sm:text-sm"
          : "px-2 py-0.5 text-[10px] sm:text-xs"
      )}
    >
      {formatPrice(price)}
    </span>
  );
}

function AddFab({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-brand-900 shadow-md transition hover:bg-brand-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        className
      )}
      aria-label={t.addToCart}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

function StatusOrAdd({
  unavailable,
  orderingDisabled,
  onAdd,
  compact,
}: {
  unavailable: boolean;
  orderingDisabled: boolean;
  onAdd: () => void;
  compact?: boolean;
}) {
  if (unavailable) {
    return (
      <span className="text-xs font-medium text-stone-500">{t.unavailable}</span>
    );
  }
  if (orderingDisabled) {
    return (
      <span className="text-xs font-medium text-amber-800">
        الطلب متوقف — الفرع مغلق
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-brand-600 font-medium text-white hover:bg-brand-700",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      )}
    >
      <Plus className="h-4 w-4" />
      {t.addToCart}
    </button>
  );
}
