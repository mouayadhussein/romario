"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Copy, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { ImageUpload } from "./ImageUpload";
import {
  deleteCategory,
  duplicateCategory,
  upsertCategory,
} from "@/lib/admin-actions";
import type { Branch, Category } from "@/types/database";

type CatForm = {
  name: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

function emptyCatForm(): CatForm {
  return { name: "", image_url: null, is_active: true, sort_order: 0 };
}

function formFromCategory(cat: Category): CatForm {
  return {
    name: cat.name,
    image_url: cat.image_url,
    is_active: cat.is_active,
    sort_order: cat.sort_order,
  };
}

function CategoryFormFields({
  form,
  setForm,
  branchId,
}: {
  form: CatForm;
  setForm: React.Dispatch<React.SetStateAction<CatForm>>;
  branchId: string;
}) {
  return (
    <div className="space-y-3">
      <Input
        label="اسم الصنف"
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <ImageUpload
        value={form.image_url}
        onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
        folder={`categories/${branchId}`}
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
          checked={form.is_active}
          onChange={(e) =>
            setForm((f) => ({ ...f, is_active: e.target.checked }))
          }
        />
        نشط
      </label>
    </div>
  );
}

export function CategoriesManager({
  branch,
  categories,
  allBranches,
}: {
  branch: Branch;
  categories: Category[];
  allBranches: Branch[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formKey, setFormKey] = useState("new");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dupCat, setDupCat] = useState<Category | null>(null);
  const [dupTarget, setDupTarget] = useState(
    allBranches.find((b) => b.id !== branch.id)?.id ?? ""
  );
  const [form, setForm] = useState<CatForm>(emptyCatForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyCatForm());
    setFormKey(`new-${Date.now()}`);
    setOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm(formFromCategory(cat));
    setFormKey(`edit-${cat.id}-${Date.now()}`);
    setOpen(true);
  }

  async function toggleActive(cat: Category) {
    const result = await upsertCategory(
      {
        branch_id: branch.id,
        name: cat.name,
        image_url: cat.image_url || "",
        is_active: !cat.is_active,
        sort_order: cat.sort_order,
      },
      cat.id
    );
    if (result.error) toast.error(result.error);
    else {
      toast.success(cat.is_active ? "تم التعطيل" : "تم التفعيل");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <AdminBreadcrumbs
        items={[
          { label: "الفروع", href: "/admin/branches" },
          { label: branch.name },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">أصناف {branch.name}</h1>
          <p className="text-sm text-stone-500">إدارة أصناف الفرع ووجباتها</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          إضافة صنف
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
          لا توجد أصناف بعد. أضف صنفاً للبدء.
        </p>
      ) : (
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div>
                <Link
                  href={`/admin/categories/${cat.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {cat.name}
                </Link>
                <p className="text-xs text-stone-500">ترتيب {cat.sort_order}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Link href={`/admin/categories/${cat.id}`}>
                  <Button size="sm" variant="outline">
                    <UtensilsCrossed className="h-4 w-4" />
                    الوجبات
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleActive(cat)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    cat.is_active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {cat.is_active ? "نشط" : "معطّل"}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDupCat(cat);
                    setDupTarget(
                      allBranches.find((b) => b.id !== branch.id)?.id ?? ""
                    );
                  }}
                  aria-label="نسخ"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(cat)}
                  aria-label="تعديل"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteId(cat.id)}
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
        title={editing ? "تعديل صنف" : "إضافة صنف"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button form="cat-form" type="submit" loading={loading}>
              حفظ
            </Button>
          </>
        }
      >
        <form
          id="cat-form"
          key={formKey}
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const result = await upsertCategory(
              {
                branch_id: branch.id,
                name: form.name,
                image_url: form.image_url || "",
                is_active: form.is_active,
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
          <CategoryFormFields form={form} setForm={setForm} branchId={branch.id} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="حذف الصنف"
        message="هل أنت متأكد من حذف هذا الصنف؟ سيتم حذف الوجبات المرتبطة."
        loading={loading}
        onConfirm={async () => {
          if (!deleteId) return;
          setLoading(true);
          const result = await deleteCategory(deleteId, branch.id);
          setLoading(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success("تم الحذف");
            setDeleteId(null);
            router.refresh();
          }
        }}
      />

      <Modal
        open={!!dupCat}
        onClose={() => setDupCat(null)}
        title={`نسخ الصنف: ${dupCat?.name ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDupCat(null)}>
              إلغاء
            </Button>
            <Button
              loading={loading}
              onClick={async () => {
                if (!dupCat || !dupTarget) return;
                setLoading(true);
                const result = await duplicateCategory(dupCat.id, dupTarget);
                setLoading(false);
                if (result.error) toast.error(result.error);
                else {
                  toast.success("تم النسخ");
                  setDupCat(null);
                }
              }}
            >
              نسخ
            </Button>
          </>
        }
      >
        <Select
          label="نسخ إلى فرع"
          value={dupTarget}
          onChange={(e) => setDupTarget(e.target.value)}
          options={allBranches
            .filter((b) => b.id !== branch.id)
            .map((b) => ({ value: b.id, label: b.name }))}
        />
      </Modal>
    </div>
  );
}
