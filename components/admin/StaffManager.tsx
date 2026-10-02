"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createStaffAction,
  updateStaffAction,
  setStaffActive,
  resetStaffPassword,
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
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    branch_ids: [] as string[],
    is_active: true,
  });

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [branches]);

  function openCreate() {
    setEditing(null);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      branch_ids: [],
      is_active: true,
    });
    setOpen(true);
  }

  function openEdit(row: StaffRow) {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      branch_ids: row.branch_ids,
      is_active: row.is_active,
    });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (editing) {
      const result = await updateStaffAction(editing.user_id, {
        full_name: form.full_name,
        phone: form.phone || null,
        branch_ids: form.branch_ids,
        is_active: form.is_active,
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
                phone: form.phone || null,
                branch_ids: form.branch_ids,
                is_active: form.is_active,
              }
            : s
        )
      );
      toast.success("تم التحديث");
    } else {
      const result = await createStaffAction({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        branch_ids: form.branch_ids,
        is_active: form.is_active,
      });
      setLoading(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.tempPassword) setTempPassword(result.tempPassword);
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
              <div>
                <p className="font-semibold text-stone-900">
                  {row.full_name}
                  {!row.is_active && (
                    <span className="ms-2 text-xs font-medium text-red-600">
                      معطّل
                    </span>
                  )}
                </p>
                <p className="text-sm text-stone-500">
                  {row.branch_ids.map(branchName).join(" · ") || "بدون فروع"}
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
                    const result = await setStaffActive(
                      row.user_id,
                      !row.is_active
                    );
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    setStaff((prev) =>
                      prev.map((s) =>
                        s.user_id === row.user_id
                          ? { ...s, is_active: !row.is_active }
                          : s
                      )
                    );
                  }}
                >
                  {row.is_active ? "تعطيل" : "تفعيل"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await resetStaffPassword(row.user_id);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    if (result.tempPassword) setTempPassword(result.tempPassword);
                  }}
                >
                  كلمة سر جديدة
                </Button>
                {row.has_records ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!row.is_active}
                    onClick={async () => {
                      if (!row.is_active) return;
                      const result = await setStaffActive(row.user_id, false);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      setStaff((prev) =>
                        prev.map((s) =>
                          s.user_id === row.user_id
                            ? { ...s, is_active: false }
                            : s
                        )
                      );
                      toast.success(
                        "تم التعطيل — لا يمكن حذف موظف له سجل"
                      );
                    }}
                  >
                    تعطيل
                  </Button>
                ) : (
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
            <Button form="staff-form" type="submit" loading={loading}>
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
          {!editing && (
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
          )}
          <Input
            label="الهاتف"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
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
        open={tempPassword != null}
        onClose={() => setTempPassword(null)}
        title="كلمة المرور المؤقتة"
        footer={
          <Button onClick={() => setTempPassword(null)}>حسناً</Button>
        }
      >
        <p className="text-sm text-stone-600">
          انسخ كلمة المرور وأرسلها للموظف. لن تظهر مرة أخرى.
        </p>
        <p
          className="mt-3 rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm"
          dir="ltr"
        >
          {tempPassword}
        </p>
      </Modal>
    </div>
  );
}
