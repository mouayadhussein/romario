"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  duplicateMenu,
  listBranchCategories,
  type BranchCategoryWithItems,
} from "@/lib/admin-actions";
import { formatPrice } from "@/lib/utils";
import type { Branch } from "@/types/database";

export function DuplicateMenuModal({
  open,
  onClose,
  branches,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  onDone: () => void;
}) {
  const [source, setSource] = useState(branches[0]?.id ?? "");
  const [target, setTarget] = useState(
    branches[1]?.id ?? branches[0]?.id ?? ""
  );
  const [categories, setCategories] = useState<BranchCategoryWithItems[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingCats, setLoadingCats] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource(branches[0]?.id ?? "");
    setTarget(branches[1]?.id ?? branches[0]?.id ?? "");
    setSelectedItems(new Set());
    setExpanded(new Set());
    setCategories([]);
  }, [open, branches]);

  useEffect(() => {
    if (!open || !source) return;

    let cancelled = false;
    setLoadingCats(true);
    setSelectedItems(new Set());
    setExpanded(new Set());

    void listBranchCategories(source).then((result) => {
      if (cancelled) return;
      setLoadingCats(false);
      if (result.error) {
        toast.error(result.error);
        setCategories([]);
        return;
      }
      setCategories(result.categories ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [open, source]);

  const allItemIds = useMemo(
    () => categories.flatMap((c) => c.items.map((i) => i.id)),
    [categories]
  );

  const allSelected =
    allItemIds.length > 0 && selectedItems.size === allItemIds.length;
  const someSelected =
    selectedItems.size > 0 && selectedItems.size < allItemIds.length;

  const targetOptions = useMemo(
    () =>
      branches
        .filter((b) => b.id !== source)
        .map((b) => ({ value: b.id, label: b.name })),
    [branches, source]
  );

  function toggleAll() {
    if (allSelected) setSelectedItems(new Set());
    else setSelectedItems(new Set(allItemIds));
  }

  function toggleCategory(cat: BranchCategoryWithItems) {
    const ids = cat.items.map((i) => i.id);
    const allOn = ids.length > 0 && ids.every((id) => selectedItems.has(id));
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    if (!allOn) {
      setExpanded((prev) => new Set(prev).add(cat.id));
    }
  }

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function categoryState(cat: BranchCategoryWithItems) {
    const ids = cat.items.map((i) => i.id);
    const selectedCount = ids.filter((id) => selectedItems.has(id)).length;
    return {
      all: ids.length > 0 && selectedCount === ids.length,
      some: selectedCount > 0 && selectedCount < ids.length,
      selectedCount,
    };
  }

  async function handleCopy() {
    if (!source || !target) {
      toast.error("اختر فرع المصدر وفرع الوجهة");
      return;
    }
    if (source === target) {
      toast.error("اختر فرعين مختلفين");
      return;
    }
    if (selectedItems.size === 0) {
      toast.error("حدّد وجبة واحدةً على الأقل");
      return;
    }

    const selections = categories
      .map((cat) => ({
        categoryId: cat.id,
        itemIds: cat.items
          .map((i) => i.id)
          .filter((id) => selectedItems.has(id)),
      }))
      .filter((s) => s.itemIds.length > 0);

    setCopying(true);
    const result = await duplicateMenu(source, target, selections);
    setCopying(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`تم نسخ ${selectedItems.size} وجبة بنجاح`);
    onDone();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="نسخ أصناف بين الفروع"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            loading={copying}
            disabled={loadingCats || selectedItems.size === 0 || !target}
            onClick={() => void handleCopy()}
          >
            نسخ المحدد ({selectedItems.size})
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="من فرع"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-800">
              اختر الأصناف والوجبات
            </p>
            {allItemIds.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
                تحديد الكل
              </label>
            )}
          </div>

          {loadingCats ? (
            <p className="py-3 text-center text-sm text-stone-500">
              جاري التحميل...
            </p>
          ) : categories.length === 0 ? (
            <p className="py-3 text-center text-sm text-stone-500">
              لا توجد أصناف في الفرع المصدر
            </p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {categories.map((cat) => {
                const state = categoryState(cat);
                const isOpen = expanded.has(cat.id);

                return (
                  <li
                    key={cat.id}
                    className="rounded-lg border border-transparent hover:border-stone-200 hover:bg-white"
                  >
                    <div className="flex items-center gap-1.5 px-1.5 py-1.5">
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={state.all}
                        ref={(el) => {
                          if (el) el.indeterminate = state.some;
                        }}
                        onChange={() => toggleCategory(cat)}
                        aria-label={`تحديد كل وجبات ${cat.name}`}
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        onClick={() => toggleExpanded(cat.id)}
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-stone-800">
                          {cat.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-stone-500">
                          {state.selectedCount}/{cat.items.length}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-stone-500 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-stone-100 pb-1.5 pe-1.5 ps-7">
                        {cat.items.length > 0 && (
                          <label className="mb-1 mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-stone-600">
                            <input
                              type="checkbox"
                              checked={state.all}
                              ref={(el) => {
                                if (el) el.indeterminate = state.some;
                              }}
                              onChange={() => toggleCategory(cat)}
                            />
                            تحديد كل الوجبات
                          </label>
                        )}
                        {cat.items.length === 0 ? (
                          <p className="py-1 text-xs text-stone-400">
                            لا توجد وجبات
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {cat.items.map((item) => (
                              <li key={item.id}>
                                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-stone-50">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                  />
                                  <span className="min-w-0 flex-1 text-xs text-stone-700">
                                    {item.name}
                                  </span>
                                  <span
                                    dir="ltr"
                                    className="shrink-0 text-[11px] text-stone-500"
                                  >
                                    {formatPrice(item.price)}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Select
          label="إلى فرع"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={
            targetOptions.length > 0
              ? targetOptions
              : [{ value: "", label: "لا يوجد فرع آخر" }]
          }
        />

        <p className="text-xs text-stone-500">
          افتح الصنف لاختيار وجبات محددة، أو استخدم «تحديد الكل» لنسخ القائمة
          كاملة.
        </p>
      </div>
    </Modal>
  );
}
