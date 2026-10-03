"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  createStaffAction,
  updateStaffAction,
  setStaffActive,
  deleteStaffAction,
} from "@/lib/order-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Branch, Staff } from "@/types/database";

type StaffRow = Staff & {
  branch_ids: string[];
  email?: string | null;
  has_records?: boolean;
};

function generatePasswordClient() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function StaffManager({
  initialStaff,
  branches,
}: {
  initialStaff: StaffRow[];
  branches: Branch[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  type StaffForm = {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    branch_ids: string[];
    is_active: boolean;
  };

  const emptyForm = (): StaffForm => ({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    branch_ids: [],
    is_active: true,
  });

  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [baseline, setBaseline] = useState<StaffForm>(emptyForm);

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [branches]);

  const isDirty = useMemo(() => {
    const sorted = (ids: string[]) => [...ids].sort().join(",");
    return (
      form.full_name.trim() !== baseline.full_name.trim() ||
      form.email.trim().toLowerCase() !== baseline.email.trim().toLowerCase() ||
      form.phone.trim() !== baseline.phone.trim() ||
      form.password.trim() !== baseline.password.trim() ||
      form.is_active !== baseline.is_active ||
      sorted(form.branch_ids) !== sorted(baseline.branch_ids)
    );
  }, [form, baseline]);

  const canSave = editing
    ? isDirty &&
      form.full_name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.branch_ids.length > 0
    : form.full_name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.branch_ids.length > 0;

  function openCreate() {
    setEditing(null);
    const next = emptyForm();
    setForm(next);
    setBaseline(next);
    setOpen(true);
  }

  function openEdit(row: StaffRow) {
    setEditing(row);
    const next: StaffForm = {
      full_name: row.full_name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      password: "",
      branch_ids: row.branch_ids,
      is_active: row.is_active,
    };
    setForm(next);
    setBaseline(next);
    setOpen(true);
  }

  function toggleBranch(id: string) {
    setForm((f) => ({
      ...f,
      branch_ids: f.branch_ids.includes(id)
        ? f.branch_ids.filter((x) => x !== id)
        : [...f.branch_ids, id],
    }));
  }

  function fillAutoPassword() {
    const pwd = generatePasswordClient();
    setForm((f) => ({ ...f, password: pwd }));
    toast.success("تم إنشاء كلمة سر تلقائياً — يمكنك تعديلها قبل الحفظ");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    if (editing) {
      const result = await updateStaffAction(editing.user_id, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        branch_ids: form.branch_ids,
        is_active: form.is_active,
        password: form.password.trim() || undefined,
      });
      setLoading(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.user_id === editing.user_id
            ? {
                ...s,
                full_name: form.full_name,
                email: form.email,
                phone: form.phone || null,
                branch_ids: form.branch_ids,
                is_active: form.is_active,
              }
            : s
        )
      );
      if (result.tempPassword) setShownPassword(result.tempPassword);
      toast.success("تم التحديث");
    } else {
      const result = await createStaffAction({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        branch_ids: form.branch_ids,
        is_active: form.is_active,
        password: form.password.trim() || undefined,
      });
      setLoading(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.tempPassword) setShownPassword(result.tempPassword);
      if (result.userId) {
        setStaff((prev) => [
          {
            user_id: result.userId!,
            full_name: form.full_name,
            phone: form.phone || null,
            is_active: form.is_active,
            created_at: new Date().toISOString(),
            branch_ids: form.branch_ids,
            email: form.email,
          },
          ...prev,
        ]);
      }
      toast.success("تم إنشاء الموظف");
    }
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">موظفو التوصيل</h1>
        <Button onClick={openCreate}>إضافة موظف</Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState title="لا يوجد موظفون بعد" />
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {staff.map((row) => (
            <li
              key={row.user_id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">
                  {row.full_name}
                  {!row.is_active && (
                    <span className="ms-2 text-xs font-medium text-red-600">
                      معطّل
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {row.branch_ids.map(branchName).join(" · ") || "بدون فروع"}
                  {row.email ? (
                    <>
                      <span className="mx-1.5 text-stone-300">·</span>
                      <span className="text-stone-400" dir="ltr">
                        {row.email}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                  تعديل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const nextActive = !row.is_active;
                    const result = await setStaffActive(row.user_id, nextActive);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    setStaff((prev) =>
                      prev.map((s) =>
                        s.user_id === row.user_id
                          ? { ...s, is_active: nextActive }
                          : s
                      )
                    );
                    toast.success(
                      nextActive
                        ? "تم التفعيل"
                        : row.has_records
                          ? "تم التعطيل — لا يمكن حذف موظف له سجل"
                          : "تم التعطيل"
                    );
                  }}
                >
                  {row.is_active ? "تعطيل" : "تفعيل"}
                </Button>
                {!row.has_records && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("حذف الموظف نهائياً؟ لا يمكن التراجع.")) return;
                      const result = await deleteStaffAction(row.user_id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      setStaff((prev) =>
                        prev.filter((s) => s.user_id !== row.user_id)
                      );
                      toast.success("تم الحذف");
                    }}
                  >
                    حذف
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل موظف" : "إضافة موظف"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button
              form="staff-form"
              type="submit"
              loading={loading}
              disabled={!canSave}
              className={
                canSave
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500"
                  : "bg-stone-200 text-stone-500 hover:bg-stone-200"
              }
            >
              حفظ
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="الاسم"
            required
            value={form.full_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, full_name: e.target.value }))
            }
          />
          <Input
            label="البريد الإلكتروني"
            type="email"
            required
            dir="ltr"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
          />

          <div className="space-y-1.5">
            <Input
              label={
                editing
                  ? "كلمة السر الجديدة (اختياري)"
                  : "كلمة السر (اختياري)"
              }
              type="text"
              dir="ltr"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={
                editing
                  ? "اتركها فارغة للإبقاء على الحالية"
                  : "فارغة = إنشاء تلقائي عند الحفظ"
              }
              autoComplete="new-password"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={fillAutoPassword}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                إنشاء تلقائي
              </Button>
              <p className="text-xs text-stone-500">
                {editing
                  ? "يمكنك كتابة كلمة سر بنفسك أو إنشاؤها تلقائياً، أو ترك الحقل فارغاً."
                  : "اكتب كلمة سر أو اضغط إنشاء تلقائي — إن تركتها فارغة تُنشأ تلقائياً عند الحفظ."}
              </p>
            </div>
          </div>

          <Input
            label="الهاتف"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <p className="-mt-1 text-xs text-stone-500">
            هذا الرقم سيظهر للزبون أثناء توصيل طلبه فقط
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-800">
              الفروع
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 text-sm text-stone-700"
                >
                  <input
                    type="checkbox"
                    checked={form.branch_ids.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </fieldset>
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
        </form>
      </Modal>

      <Modal
        open={shownPassword != null}
        onClose={() => setShownPassword(null)}
        title="كلمة المرور"
        footer={
          <Button onClick={() => setShownPassword(null)}>حسناً</Button>
        }
      >
        <p className="text-sm text-stone-600">
          انسخ كلمة المرور وأرسلها للموظف. لن تظهر مرة أخرى من هنا.
        </p>
        <p
          className="mt-3 rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm"
          dir="ltr"
        >
          {shownPassword}
        </p>
      </Modal>
    </div>
  );
}
