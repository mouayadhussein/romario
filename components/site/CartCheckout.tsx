"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { BranchOpenBadge } from "./BranchHours";
import { formatPrice } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";
import { getBranchStatus } from "@/lib/opening-hours";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import type { Branch, OrderType } from "@/types/database";
import Link from "next/link";

const t = getDictionary("ar").site;

type CustomerLocation = { lat: number; lng: number };

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "تم رفض إذن الموقع. لتفعيله: افتح إعدادات المتصفح لهذا الموقع واسمح بالوصول إلى الموقع، ثم أعد المحاولة.";
    case error.POSITION_UNAVAILABLE:
      return "تعذّر تحديد موقعك حالياً. تأكد من تفعيل خدمة الموقع في الجهاز ثم أعد المحاولة.";
    case error.TIMEOUT:
      return "انتهت مهلة تحديد الموقع. حاول مرة أخرى في مكان بإشارة أفضل.";
    default:
      return "حدث خطأ أثناء تحديد الموقع. حاول مرة أخرى.";
  }
}

export function CartCheckout({ branch }: { branch: Branch }) {
  const router = useRouter();
  const { items, updateQuantity, updateNote, removeItem, clearCart, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<CustomerLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    tableNumber: "",
    generalNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const status = useMemo(() => getBranchStatus(branch), [branch]);
  const orderingDisabled = !status.isOpen;

  function handleOrderTypeChange(next: OrderType) {
    setOrderType(next);
    if (next !== "delivery") {
      setLocation(null);
      setLocationError(null);
    }
  }

  function locateMe() {
    setLocationError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("متصفحك لا يدعم تحديد الموقع.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
        toast.success("تم تحديد الموقع");
      },
      (err) => {
        setLocation(null);
        setLocationError(geolocationErrorMessage(err));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t.emptyCart}
        action={
          <Link href={`/${branch.slug}`}>
            <Button>{t.continueShopping}</Button>
          </Link>
        }
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (orderingDisabled) {
      toast.error(status.reason || "الفرع مغلق حالياً ولا يمكن إرسال الطلب");
      return;
    }
    setErrors({});
    setLoading(true);

    const deliveryLocation =
      orderType === "delivery" && location
        ? { customerLat: location.lat, customerLng: location.lng }
        : { customerLat: null, customerLng: null };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress || null,
          ...deliveryLocation,
          orderType,
          tableNumber: form.tableNumber || null,
          generalNote: form.generalNote || null,
          items: items.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            note: i.note || null,
          })),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
        orderNumber?: string;
        total?: number;
        orderItems?: {
          name: string;
          quantity: number;
          price: number;
          note: string | null;
        }[];
      };

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        toast.error(data.error || "فشل إنشاء الطلب");
        return;
      }

      const orderNumber = data.orderNumber!;
      const orderItems = data.orderItems ?? items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        note: i.note || null,
      }));
      const orderTotal = data.total ?? total;

      clearCart();

      if (branch.whatsapp_number) {
        const message = buildWhatsAppMessage({
          orderNumber,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress,
          customerLat: deliveryLocation.customerLat,
          customerLng: deliveryLocation.customerLng,
          orderType,
          tableNumber: form.tableNumber,
          generalNote: form.generalNote,
          items: orderItems,
          total: orderTotal,
          branchName: branch.name,
        });
        const url = buildWhatsAppUrl(branch.whatsapp_number, message);
        if (url) window.open(url, "_blank");
      }

      router.push(`/${branch.slug}/confirmation?order=${encodeURIComponent(orderNumber)}`);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <BranchOpenBadge branch={branch} />

      {orderingDisabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          لا يمكن إرسال الطلب الآن لأن الفرع مغلق. سلة مشترياتك محفوظة ويمكنك
          إكمال الطلب عند فتح الفرع.
          <br />
          <span className="font-medium">{status.reason}</span>
        </div>
      )}

      <section className="space-y-3">
        <h1 className="text-xl font-bold text-stone-900">{t.cart}</h1>
        {items.map((item) => (
          <div
            key={item.itemId}
            className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
          >
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="64px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-stone-900">{item.name}</h3>
                  <button
                    type="button"
                    onClick={() => removeItem(item.itemId)}
                    className="text-stone-400 hover:text-red-600"
                    aria-label={t.removeItem}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-brand-700">{formatPrice(item.price)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-stone-300 p-1"
                    onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                    aria-label="إنقاص"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-md border border-stone-300 p-1"
                    onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                    aria-label="زيادة"
                    disabled={orderingDisabled}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="mr-auto text-sm font-bold">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2">
              <Input
                label={t.itemNote}
                placeholder={t.itemNotePlaceholder}
                value={item.note}
                onChange={(e) => updateNote(item.itemId, e.target.value)}
              />
            </div>
          </div>
        ))}
      </section>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">{t.checkout}</h2>
        <Input
          label={t.customerName}
          name="customerName"
          required
          value={form.customerName}
          error={errors.customerName}
          onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
          disabled={orderingDisabled}
        />
        <Input
          label={t.customerPhone}
          name="customerPhone"
          required
          dir="ltr"
          value={form.customerPhone}
          error={errors.customerPhone}
          onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
          disabled={orderingDisabled}
        />
        <Select
          label={t.orderType}
          name="orderType"
          value={orderType}
          onChange={(e) => handleOrderTypeChange(e.target.value as OrderType)}
          disabled={orderingDisabled}
          options={[
            { value: "delivery", label: t.delivery },
            { value: "pickup", label: t.pickup },
            { value: "dine_in", label: t.dineIn },
          ]}
        />
        {orderType === "delivery" && (
          <>
            <Textarea
              label={t.customerAddress}
              name="customerAddress"
              required
              value={form.customerAddress}
              error={errors.customerAddress}
              onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))}
              disabled={orderingDisabled}
            />

            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm font-medium text-stone-800">الموقع على الخريطة (اختياري)</p>
              {!location ? (
                <Button
                  type="button"
                  variant="outline"
                  loading={locating}
                  disabled={orderingDisabled || locating}
                  onClick={locateMe}
                >
                  <MapPin className="h-4 w-4" />
                  📍 حدد موقعي
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-800">تم تحديد الموقع</p>
                  <p className="text-xs text-stone-500" dir="ltr">
                    {location.lat}, {location.lng}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={mapsUrl(location.lat, location.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-stone-50"
                    >
                      عرض على الخريطة
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLocation(null);
                        setLocationError(null);
                      }}
                    >
                      إزالة الموقع
                    </Button>
                  </div>
                </div>
              )}
              {locationError && (
                <p className="text-xs text-red-600">{locationError}</p>
              )}
              <p className="text-xs text-stone-500">
                نستخدم موقعك فقط لتوصيل هذا الطلب
              </p>
            </div>
          </>
        )}
        {orderType === "dine_in" && (
          <Input
            label={t.tableNumber}
            name="tableNumber"
            required
            value={form.tableNumber}
            error={errors.tableNumber}
            onChange={(e) => setForm((f) => ({ ...f, tableNumber: e.target.value }))}
            disabled={orderingDisabled}
          />
        )}
        <Textarea
          label={t.generalNote}
          name="generalNote"
          placeholder={t.generalNotePlaceholder}
          value={form.generalNote}
          onChange={(e) => setForm((f) => ({ ...f, generalNote: e.target.value }))}
          disabled={orderingDisabled}
        />

        <div className="rounded-xl bg-stone-50 p-4">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>{t.total}</span>
            <span className="text-brand-700">{formatPrice(total)}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-emerald-700">{t.cashOnDelivery}</p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={orderingDisabled}
        >
          {orderingDisabled ? "الفرع مغلق — لا يمكن إرسال الطلب" : t.submitOrder}
        </Button>
      </form>
    </div>
  );
}
