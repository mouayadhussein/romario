"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { OpeningHoursEditor } from "./OpeningHoursEditor";
import { upsertBranch } from "@/lib/admin-actions";
import { slugify } from "@/lib/utils";
import { TIMEZONE_OPTIONS, type OpeningHours, type OrderingMode } from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

function emptyOpeningHours(): OpeningHours {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
}

function emptyForm() {
  return {
    name: "",
    slug: "",
    address: "",
    phone: "",
    whatsapp_number: "",
    map_url: "",
    working_hours: "",
    opening_hours: emptyOpeningHours(),
    timezone: "Asia/Damascus",
    ordering_mode: "auto" as OrderingMode,
    is_active: true,
    sort_order: 0,
  };
}

function formFromBranch(branch: Branch) {
  return {
    name: branch.name,
    slug: branch.slug,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    whatsapp_number: branch.whatsapp_number ?? "",
    map_url: branch.map_url ?? "",
    working_hours: branch.working_hours ?? "",
    opening_hours: {
      ...emptyOpeningHours(),
      ...(branch.opening_hours ?? {}),
    },
    timezone: branch.timezone || "Asia/Damascus",
    ordering_mode: branch.ordering_mode || "auto",
    is_active: branch.is_active,
    sort_order: branch.sort_order,
  };
}

export function BranchFormModal({
  open,
  onClose,
  branch,
  onSaved,
  formKey,
}: {
  open: boolean;
  onClose: () => void;
  branch?: Branch | null;
  onSaved: () => void;
  formKey: string;
}) {
  const [loading, setLoading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!branch);
  const [form, setForm] = useState(() =>
    branch ? formFromBranch(branch) : emptyForm()
  );

  // Remount-friendly: when formKey changes, parent remounts this with key=
  void formKey;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await upsertBranch(
      {
        ...form,
        slug: form.slug.trim(),
        map_url: form.map_url || null,
        sort_order: Number(form.sort_order) || 0,
      },
      branch?.id
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم الحفظ");
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? "تعديل فرع" : "إضافة فرع"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button form="branch-form" type="submit" loading={loading}>
            حفظ
          </Button>
        </>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="الاسم"
          required
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({
              ...f,
              name,
              slug: !branch && !slugTouched ? slugify(name) : f.slug,
            }));
          }}
        />
        <Input
          label="المعرّف (Slug) — اختياري"
          dir="ltr"
          placeholder="يُولَّد تلقائياً من الاسم"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
          }}
        />
        <p className="text-xs text-stone-500">
          أحرف إنجليزية صغيرة وأرقام وشرطات فقط. إن تُرِك فارغاً يُولَّد تلقائياً.
        </p>
        <Textarea
          label="العنوان"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <Input
          label="الهاتف"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Input
          label="رقم واتساب (مع رمز الدولة)"
          dir="ltr"
          placeholder="905348271939"
          value={form.whatsapp_number}
          onChange={(e) =>
            setForm((f) => ({ ...f, whatsapp_number: e.target.value }))
          }
        />
        <p className="text-xs text-stone-500" dir="ltr">
          مثال: 905348271939 (رمز الدولة ثم الرقم بدون + أو 00 أو مسافات)
        </p>
        <Input
          label="رابط الخريطة"
          dir="ltr"
          value={form.map_url}
          onChange={(e) => setForm((f) => ({ ...f, map_url: e.target.value }))}
        />

        <OpeningHoursEditor
          value={form.opening_hours}
          onChange={(opening_hours) =>
            setForm((f) => ({ ...f, opening_hours }))
          }
        />
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <strong>مهم:</strong> «منشور/مخفي» يتحكم بظهور الفرع في الموقع.
          أما «مفتوح/مغلق الآن» عند الزبون فيتبع جدول الساعات أعلاه (أو وضع التجاوز
          اليدوي). إن لم تضبط أي يوم، يُعتبر الفرع مفتوحاً للطلبات طالما هو منشور.
        </p>

        <Select
          label="المنطقة الزمنية"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          options={TIMEZONE_OPTIONS.map((tz) => ({
            value: tz.value,
            label: tz.label,
          }))}
        />

        <Select
          label="وضع استقبال الطلبات"
          value={form.ordering_mode}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              ordering_mode: e.target.value as OrderingMode,
            }))
          }
          options={[
            { value: "auto", label: "تلقائي حسب الجدول" },
            { value: "force_open", label: "مفتوح الآن (تجاوز يدوي)" },
            { value: "force_closed", label: "مغلق الآن (تجاوز يدوي)" },
          ]}
        />

        <Input
          label="ساعات العمل (نص حر للعرض — اختياري)"
          value={form.working_hours}
          onChange={(e) =>
            setForm((f) => ({ ...f, working_hours: e.target.value }))
          }
          placeholder="يُستخدم فقط إن لم يُضبط الجدول أعلاه"
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
      </form>
    </Modal>
  );
}
