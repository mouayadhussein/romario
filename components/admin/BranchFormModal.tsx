"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { OpeningHoursEditor } from "./OpeningHoursEditor";
import { upsertBranch } from "@/lib/admin-actions";
import { slugify } from "@/lib/utils";
import { TIMEZONE_OPTIONS, type OpeningHours } from "@/lib/opening-hours";
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

/** Normalize common Google Maps paste formats into a clean maps URL. */
function normalizeGoogleMapsUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  // Already a full URL
  try {
    const url = new URL(value);

    // https://www.google.com/maps?q=33.5,36.2
    const q = url.searchParams.get("q");
    if (q && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(q)) {
      const [lat, lng] = q.split(",").map((p) => p.trim());
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    // https://www.google.com/maps/@33.5,36.2,17z
    const atMatch = url.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      return `https://www.google.com/maps?q=${atMatch[1]},${atMatch[2]}`;
    }

    // https://www.google.com/maps/place/.../@33.5,36.2,17z
    const placeAt = value.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (placeAt) {
      return `https://www.google.com/maps?q=${placeAt[1]},${placeAt[2]}`;
    }

    // Keep valid Google Maps / short links as-is
    if (
      url.hostname.includes("google.") ||
      url.hostname.includes("goo.gl") ||
      url.hostname.includes("maps.app.goo.gl")
    ) {
      return value;
    }
  } catch {
    // not a URL — maybe "lat,lng"
  }

  const coords = value.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coords) {
    return `https://www.google.com/maps?q=${coords[1]},${coords[2]}`;
  }

  return value;
}

function emptyForm() {
  return {
    name: "",
    slug: "",
    address: "",
    phone: "",
    whatsapp_number: "",
    map_url: "",
    opening_hours: emptyOpeningHours(),
    timezone: "Asia/Damascus",
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
    opening_hours: {
      ...emptyOpeningHours(),
      ...(branch.opening_hours ?? {}),
    },
    timezone: branch.timezone || "Asia/Damascus",
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
        map_url: form.map_url ? normalizeGoogleMapsUrl(form.map_url) : null,
        working_hours: branch?.working_hours ?? null,
        ordering_mode: "auto",
        is_active: branch ? form.is_active : true,
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

        <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-800">موقع الفرع على خرائط Google</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={
                form.address.trim()
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address.trim())}`
                  : "https://www.google.com/maps"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-2 text-xs font-bold text-brand-500 hover:bg-brand-800"
            >
              <MapPin className="h-3.5 w-3.5" />
              فتح خرائط Google لاختيار الموقع
            </a>
            {form.map_url && (
              <a
                href={normalizeGoogleMapsUrl(form.map_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                معاينة الرابط
              </a>
            )}
          </div>
          <Input
            label="الصق رابط الموقع من Google Maps"
            dir="ltr"
            placeholder="https://maps.app.goo.gl/... أو https://www.google.com/maps?q=..."
            value={form.map_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, map_url: e.target.value }))
            }
            onBlur={() =>
              setForm((f) => ({
                ...f,
                map_url: normalizeGoogleMapsUrl(f.map_url),
              }))
            }
          />
          <p className="text-xs text-stone-500">
            من خرائط Google: اختر المكان ← مشاركة ← نسخ الرابط ← الصقه هنا.
            يمكنك أيضاً لصق إحداثيات مثل: 33.5138,36.2765
          </p>
        </div>

        <OpeningHoursEditor
          value={form.opening_hours}
          onChange={(opening_hours) =>
            setForm((f) => ({ ...f, opening_hours }))
          }
        />
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <strong>مهم:</strong> «منشور/مخفي» يتحكم بظهور الفرع في الموقع. حالة
          الطلبات (مفتوح/مغلق) تتبع جدول الساعات أعلاه تلقائياً.
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

        <Input
          label="الترتيب"
          type="number"
          value={form.sort_order}
          onChange={(e) =>
            setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
          }
        />
        {branch ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
            />
            نشط (منشور)
          </label>
        ) : (
          <p className="text-xs text-stone-500">
            الفرع سيُنشأ منشوراً تلقائياً. يمكنك إخفاءه لاحقاً من جدول الفروع أو التعديل.
          </p>
        )}
      </form>
    </Modal>
  );
}
