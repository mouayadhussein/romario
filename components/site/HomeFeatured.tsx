import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { FeaturedMeal } from "@/lib/featured-items";

export function HomeFeatured({ meals }: { meals: FeaturedMeal[] }) {
  if (meals.length === 0) return null;

  return (
    <section
      id="featured"
      className="scroll-mt-28 overflow-x-clip px-3 py-8 sm:px-4 sm:py-10"
      aria-labelledby="featured-heading"
    >
      <div className="mx-auto min-w-0 max-w-3xl">
        <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
          <div>
            <p className="inline-flex rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-brand-500">
              مميز
            </p>
            <h2
              id="featured-heading"
              className="mt-2 font-display text-2xl font-bold text-brand-900 sm:text-3xl"
            >
              وجبات مميزة
            </h2>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {meals.map((meal) => (
            <Link
              key={`${meal.branchSlug}-${meal.id}`}
              href={`/${meal.branchSlug}`}
              className="block overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
            >
              <article>
                <div className="relative aspect-16/10 bg-stone-100 sm:aspect-video">
                  {meal.imageUrl ? (
                    <Image
                      src={meal.imageUrl}
                      alt={meal.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 720px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-stone-400">
                      بدون صورة
                    </div>
                  )}
                  <div
                    className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
                    <h3 className="min-w-0 flex-1 text-start font-display text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-xl">
                      {meal.name}
                    </h3>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm sm:text-sm">
                      {formatPrice(meal.price)}
                    </span>
                  </div>
                </div>
                {(meal.description || meal.branchName) && (
                  <p className="line-clamp-2 px-3 py-2.5 text-xs leading-relaxed text-stone-500 sm:px-4 sm:py-3 sm:text-sm">
                    {meal.description || meal.branchName}
                  </p>
                )}
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
