"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Store } from "lucide-react";
import type { HomeSearchCategory } from "./HomeHeader";

function subscribeNoop() {
  return () => {};
}

function CategoryTile({ category }: { category: HomeSearchCategory }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const single = category.branches.length === 1;
  const onlyBranch = category.branches[0];

  function updatePosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 176; // w-44
    const padding = 8;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - menuWidth - padding)
    );
    const top = rect.bottom + 8;
    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const visual = (
    <>
      <div className="relative h-20 w-20 overflow-hidden rounded-full border-[3px] border-brand-500 bg-brand-50 shadow-sm transition duration-300 group-hover:scale-105 sm:h-24 sm:w-24">
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-brand-600">
            <Store className="h-7 w-7" />
          </span>
        )}
      </div>
      <span className="line-clamp-2 text-center text-sm font-bold text-stone-800">
        {category.name}
      </span>
      <span className="inline-flex max-w-full items-center gap-0.5 text-[11px] text-stone-500">
        <span className="truncate">
          {single && onlyBranch
            ? onlyBranch.name
            : `${category.branches.length} فروع`}
        </span>
        {!single && (
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </span>
    </>
  );

  if (single && onlyBranch) {
    return (
      <Link
        href={`/${onlyBranch.slug}`}
        className="group flex w-[6.5rem] shrink-0 flex-col items-center gap-2 sm:w-28"
      >
        {visual}
      </Link>
    );
  }

  return (
    <>
      <div className="relative w-[6.5rem] shrink-0 sm:w-28">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          className="group flex w-full flex-col items-center gap-2"
        >
          {visual}
        </button>
      </div>

      {mounted &&
        open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={`اختر فرع لصنف ${category.name}`}
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-[80] w-44 origin-top animate-dropdown-in rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
          >
            <p className="px-2 pb-1.5 text-[11px] font-bold text-stone-500">
              اختر الفرع
            </p>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {category.branches.map((branch) => (
                <li key={branch.id} role="option" aria-selected={false}>
                  <Link
                    href={`/${branch.slug}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-2.5 py-2 text-sm font-semibold text-stone-800 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {branch.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

export function HomeCategories({
  categories,
}: {
  categories: HomeSearchCategory[];
}) {
  if (categories.length === 0) return null;

  return (
    <section
      id="categories"
      className="scroll-mt-28 overflow-x-clip border-t border-stone-200/70 px-4 py-14 sm:py-16"
    >
      <div className="mx-auto min-w-0 max-w-6xl">
        <div className="mb-8">
          <p className="inline-flex rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-brand-500">
            الأصناف
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-brand-900 sm:text-4xl">
            أصناف القائمة
          </h2>
        </div>

        <div className="flex min-w-0 gap-5 overflow-x-auto overscroll-x-contain overflow-y-visible pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <CategoryTile key={cat.name} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}
