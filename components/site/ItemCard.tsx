"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import type { Item } from "@/types/database";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary("ar").site;

export function ItemCard({
  item,
  orderingDisabled = false,
}: {
  item: Item;
  orderingDisabled?: boolean;
}) {
  const { addItem } = useCart();
  const unavailable = !item.is_available;
  const disabled = unavailable || orderingDisabled;

  return (
    <article
      className={`flex gap-3 overflow-hidden rounded-xl border bg-white p-3 shadow-sm ${
        disabled ? "border-stone-200 opacity-60" : "border-stone-200"
      }`}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
            بدون صورة
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-stone-900">{item.name}</h3>
          <span className="shrink-0 text-sm font-bold text-brand-700">
            {formatPrice(Number(item.price))}
          </span>
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{item.description}</p>
        )}
        <div className="mt-auto pt-2">
          {unavailable ? (
            <span className="text-xs font-medium text-stone-500">{t.unavailable}</span>
          ) : orderingDisabled ? (
            <span className="text-xs font-medium text-amber-800">
              الطلب متوقف — الفرع مغلق
            </span>
          ) : (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                addItem({
                  itemId: item.id,
                  name: item.name,
                  price: Number(item.price),
                  imageUrl: item.image_url,
                });
                toast.success(`تمت إضافة ${item.name}`);
              }}
            >
              <Plus className="h-4 w-4" />
              {t.addToCart}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
