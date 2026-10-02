"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { OpeningHoursEditor } from "./OpeningHoursEditor";
import { LocationPickerModal } from "@/components/site/LocationPickerModal";
import { upsertBranch } from "@/lib/admin-actions";
import { slugify } from "@/lib/utils";
import { hasGoogleMapsApiKey, type LatLng } from "@/lib/google-maps";
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

function emptyForm() {
  return {
    name: "",
    slug: "",
    address: "",
    phone: "",
    whatsapp_number: "",
    latitude: null as number | null,
    longitude: null as number | null,
    map_url: null as string | null,
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
    latitude: branch.latitude ?? null,
    longitude: branch.longitude ?? null,
    map_url: branch.map_url ?? null,
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
  const [mapOpen, setMapOpen] = useState(false);
  const mapsEnabled = hasGoogleMapsApiKey();
  const [form, setForm] = useState(() =>
    branch ? formFromBranch(branch) : emptyForm()
  );

  // Remount-friendly: when formKey changes, parent remounts this with key=
  void formKey;

  const hasCoords = form.latitude != null && form.longitude != null;
  const pickerInitial: LatLng | null = hasCoords
    ? { lat: form.latitude!, lng: form.longitude! }
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const map_url = hasCoords
      ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}`
      : form.map_url;

    const result = await upsertBranch(
      {
        name: form.name,
        slug: form.slug.trim(),
        address: form.address,
        phone: form.phone,
        whatsapp_number: form.whatsapp_number,
        latitude: form.latitude,
        longitude: form.longitude,
        map_url,
        working_hours: branch?.working_hours ?? null,
        opening_hours: form.opening_hours,
        timezone: form.timezone,
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
    <>
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
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
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
            <p className="text-sm font-medium text-stone-800">
              موقع الفرع على الخريطة
            </p>
            <p className="text-xs text-stone-500">تحديد الموقع اختياري</p>

            {!hasCoords ? (
              mapsEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMapOpen(true)}
                >
                  📍 تحديد موقع الفرع على الخريطة
                </Button>
              ) : (
                <p className="text-xs text-amber-800">
                  أضف مفتاح Google Maps لتفعيل تحديد الموقع على الخريطة.
                </p>
              )
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-800">
                  تم تحديد الموقع ✓
                </p>
                <div className="flex flex-wrap gap-2">
                  {mapsEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMapOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        latitude: null,
                        longitude: null,
                      }))
                    }
                  >
                    إزالة
                  </Button>
                </div>
              </div>
            )}
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
            onChange={(e) =>
              setForm((f) => ({ ...f, timezone: e.target.value }))
            }
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
              الفرع سيُنشأ منشوراً تلقائياً. يمكنك إخفاءه لاحقاً من جدول الفروع أو
              التعديل.
            </p>
          )}
        </form>
      </Modal>

      {mapsEnabled && (
        <LocationPickerModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          initialLocation={pickerInitial}
          title="تحديد موقع الفرع"
          onConfirm={(next) => {
            setForm((f) => ({
              ...f,
              latitude: next.lat,
              longitude: next.lng,
            }));
            toast.success("تم تحديد الموقع");
          }}
        />
      )}
    </>
  );
}
