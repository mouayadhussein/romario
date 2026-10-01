"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { ImageUpload } from "./ImageUpload";
import { deleteItem, upsertItem } from "@/lib/admin-actions";
import { formatPrice } from "@/lib/utils";
import type { Branch, Category, Item } from "@/types/database";

type ItemForm = {
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

function emptyItemForm(): ItemForm {
  return {
    name: "",
    description: "",
    price: 0,
    image_url: null,
    is_available: true,
    sort_order: 0,
  };
}

function formFromItem(item: Item): ItemForm {
  return {
    name: item.name,
    description: item.description ?? "",
    price: Number(item.price),
    image_url: item.image_url,
    is_available: item.is_available,
    sort_order: item.sort_order,
  };
}

export function ItemsManager({
  category,
  branch,
  items,
}: {
  category: Category;
  branch: Pick<Branch, "id" | "name">;
  items: Item[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formKey, setFormKey] = useState("new");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyItemForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyItemForm());
    setFormKey(`new-${Date.now()}`);
    setOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm(formFromItem(item));
    setFormKey(`edit-${item.id}-${Date.now()}`);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <AdminBreadcrumbs
        items={[
          { label: "الفروع", href: "/admin/branches" },
          { label: branch.name, href: `/admin/branches/${branch.id}` },
          { label: category.name },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">وجبات {category.name}</h1>
          <p className="text-sm text-stone-500">إدارة وجبات الصنف</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          إضافة وجبة
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
          لا توجد وجبات بعد. أضف وجبة للبدء.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {formatPrice(Number(item.price))} ·{" "}
                  {item.is_available ? "متوفر" : "غير متوفر"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await upsertItem(
                      {
                        category_id: category.id,
                        name: item.name,
                        description: item.description,
                        price: Number(item.price),
                        image_url: item.image_url || "",
                        is_available: !item.is_available,
                        sort_order: item.sort_order,
                      },
                      item.id
                    );
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("تم التحديث");
                      router.refresh();
                    }
                  }}
                >
                  {item.is_available ? "غير متوفر" : "متوفر"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(item)}
                  aria-label="تعديل"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteId(item.id)}
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل وجبة" : "إضافة وجبة"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button form="item-form" type="submit" loading={loading}>
              حفظ
            </Button>
          </>
        }
      >
        <form
          id="item-form"
          key={formKey}
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const result = await upsertItem(
              {
                category_id: category.id,
                name: form.name,
                description: form.description || null,
                price: Number(form.price),
                image_url: form.image_url || "",
                is_available: form.is_available,
                sort_order: Number(form.sort_order) || 0,
              },
              editing?.id
            );
            setLoading(false);
            if (result.error) toast.error(result.error);
            else {
              toast.success("تم الحفظ");
              setOpen(false);
              router.refresh();
            }
          }}
        >
          <Input
            label="اسم الوجبة"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Textarea
            label="الوصف"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Input
            label="السعر"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.price}
            onChange={(e) =>
              setForm((f) => ({ ...f, price: Number(e.target.value) }))
            }
          />
          <ImageUpload
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            folder={`items/${category.id}`}
          />
          <Input
            label="الترتيب"
            type="number"
            value={form.sort_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_available: e.target.checked }))
              }
            />
            متوفر
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="حذف الوجبة"
        message="هل أنت متأكد من حذف هذه الوجبة؟"
        loading={loading}
        onConfirm={async () => {
          if (!deleteId) return;
          setLoading(true);
          const result = await deleteItem(deleteId, category.id);
          setLoading(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success("تم الحذف");
            setDeleteId(null);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
