"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Minus, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BranchOpenBadge } from "./BranchHours";
import { LocationPickerModal } from "./LocationPickerModal";
import { formatPrice } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";
import { getBranchStatus } from "@/lib/opening-hours";
import {
  geolocationErrorMessage,
  hasGoogleMapsApiKey,
  roundLatLng,
  type LatLng,
} from "@/lib/google-maps";
import { calculateOrderFees } from "@/lib/order-fees";
import type { Branch, OrderType } from "@/types/database";
import Link from "next/link";

const t = getDictionary("ar").site;

export function CartCheckout({ branch }: { branch: Branch }) {
  const router = useRouter();
  const { items, updateQuantity, updateNote, removeItem, clearCart, total } =
    useCart();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const mapsEnabled = hasGoogleMapsApiKey();
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

  const deliveryFeeConfigured = Number(branch.delivery_fee ?? 0);
  const minOrderAmount = Number(branch.min_order_amount ?? 0);
  const freeDeliveryThreshold =
    branch.free_delivery_threshold == null
      ? null
      : Number(branch.free_delivery_threshold);

  const fees = useMemo(
    () =>
      calculateOrderFees({
        orderType,
        subtotal: total,
        deliveryFee: deliveryFeeConfigured,
        minOrderAmount,
        freeDeliveryThreshold,
      }),
    [
      orderType,
      total,
      deliveryFeeConfigured,
      minOrderAmount,
      freeDeliveryThreshold,
    ]
  );

  const showFeeBreakdown =
    orderType === "delivery" &&
    (deliveryFeeConfigured > 0 ||
      minOrderAmount > 0 ||
      freeDeliveryThreshold != null);

  const belowMin = orderType === "delivery" && !fees.minOrderOk;

  function handleOrderTypeChange(next: OrderType) {
    setOrderType(next);
    if (next !== "delivery") {
      setLocation(null);
      setLocationError(null);
      setMapOpen(false);
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
        setLocation(
          roundLatLng({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
        );
        setLocating(false);
        toast.success("تم تحديد الموقع");
      },
      (err) => {
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

  function validateBeforeSubmit(): boolean {
    if (orderingDisabled) {
      toast.error(status.reason || "الفرع مغلق حالياً ولا يمكن إرسال الطلب");
      return false;
    }
    if (belowMin) {
      toast.error(
        `الحد الأدنى للطلب ${formatPrice(minOrderAmount)}. ينقصك ${formatPrice(fees.minOrderShortfall)}.`
      );
      return false;
    }
    setErrors({});

    if (orderType === "delivery") {
      const hasAddress = Boolean(form.customerAddress.trim());
      const hasLocation = location != null;
      if (!hasAddress && !hasLocation) {
        const msg = t.deliveryLocationRequired;
        setErrors({ customerAddress: msg });
        toast.error(msg);
        return false;
      }
    }

    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateBeforeSubmit()) return;

    // Delivery: confirm paid delivery notice before sending
    if (orderType === "delivery") {
      setConfirmOpen(true);
      return;
    }

    void submitOrder();
  }

  async function submitOrder() {
    setLoading(true);

    const deliveryLocation =
      orderType === "delivery" && location
        ? { customerLat: location.lat, customerLng: location.lng }
        : { customerLat: null, customerLng: null };

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
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
        trackingToken?: string;
        subtotal?: number;
        deliveryFee?: number;
        total?: number;
      };

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        const fieldMsg = data.fieldErrors
          ? Object.values(data.fieldErrors)[0]
          : undefined;
        toast.error(data.error || fieldMsg || "فشل إنشاء الطلب");
        return;
      }

      const orderNumber = data.orderNumber!;
      const trackingToken = data.trackingToken;

      clearCart();
      setConfirmOpen(false);

      const confirmQs = new URLSearchParams({
        order: orderNumber,
      });
      if (trackingToken) confirmQs.set("tracking", trackingToken);

      router.push(`/${branch.slug}/confirmation?${confirmQs.toString()}`);
    } catch {
      toast.error(
        "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
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
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
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
                    onClick={() =>
                      updateQuantity(item.itemId, item.quantity - 1)
                    }
                    aria-label="إنقاص"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-stone-300 p-1"
                    onClick={() =>
                      updateQuantity(item.itemId, item.quantity + 1)
                    }
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

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-lg font-bold text-stone-900">{t.checkout}</h2>
        <Input
          label={t.customerName}
          name="customerName"
          required
          value={form.customerName}
          error={errors.customerName}
          onChange={(e) =>
            setForm((f) => ({ ...f, customerName: e.target.value }))
          }
          disabled={orderingDisabled}
        />
        <Input
          label={t.customerPhone}
          name="customerPhone"
          required
          dir="ltr"
          value={form.customerPhone}
          error={errors.customerPhone}
          onChange={(e) =>
            setForm((f) => ({ ...f, customerPhone: e.target.value }))
          }
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
              value={form.customerAddress}
              error={errors.customerAddress}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerAddress: e.target.value }))
              }
              disabled={orderingDisabled}
            />
            <p className="-mt-2 text-xs text-stone-500">
              {t.deliveryLocationHint}
            </p>

            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm font-medium text-stone-800">
                الموقع على الخريطة
              </p>
              <p className="text-xs text-stone-500">
                {location
                  ? "تم تحديد الموقع — يمكنك المتابعة بدون كتابة عنوان"
                  : "بديل عن العنوان النصي، أو معه للتوضيح"}
              </p>

              {!location ? (
                mapsEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={orderingDisabled}
                    onClick={() => {
                      setLocationError(null);
                      setMapOpen(true);
                    }}
                  >
                    📍 تحديد الموقع على الخريطة
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    loading={locating}
                    disabled={orderingDisabled || locating}
                    onClick={locateMe}
                  >
                    استخدم موقعي الحالي
                  </Button>
                )
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-800">
                    تم تحديد الموقع ✓
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={orderingDisabled}
                      onClick={() => {
                        setLocationError(null);
                        if (mapsEnabled) setMapOpen(true);
                        else locateMe();
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLocation(null);
                        setLocationError(null);
                      }}
                    >
                      إزالة
                    </Button>
                  </div>
                </div>
              )}
              {locationError && (
                <p className="text-xs text-red-600">{locationError}</p>
              )}
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
            onChange={(e) =>
              setForm((f) => ({ ...f, tableNumber: e.target.value }))
            }
            disabled={orderingDisabled}
          />
        )}
        <Textarea
          label={t.generalNote}
          name="generalNote"
          placeholder={t.generalNotePlaceholder}
          value={form.generalNote}
          onChange={(e) =>
            setForm((f) => ({ ...f, generalNote: e.target.value }))
          }
          disabled={orderingDisabled}
        />

        <div className="rounded-xl bg-stone-50 p-4">
          {showFeeBreakdown ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>المجموع الفرعي</span>
                <span dir="ltr">{formatPrice(fees.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  رسوم التوصيل
                  {fees.freeDeliveryApplied ? " (مجاني)" : ""}
                </span>
                <span dir="ltr">{formatPrice(fees.deliveryFee)}</span>
              </div>
              {minOrderAmount > 0 && (
                <p className="text-xs text-stone-500">
                  الحد الأدنى للطلب: {formatPrice(minOrderAmount)}
                </p>
              )}
              {belowMin && (
                <p className="text-xs font-medium text-red-600">
                  ينقصك {formatPrice(fees.minOrderShortfall)} للوصول للحد الأدنى
                </p>
              )}
              <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-lg font-bold">
                <span>{t.total}</span>
                <span className="text-brand-700">{formatPrice(fees.total)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-lg font-bold">
              <span>{t.total}</span>
              <span className="text-brand-700">{formatPrice(fees.total)}</span>
            </div>
          )}
          <p className="mt-1 text-sm font-medium text-emerald-700">
            {t.cashOnDelivery}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            بياناتك (الاسم، الهاتف، العنوان، الموقع) تُستخدم فقط لتنفيذ هذا
            الطلب والتواصل معك بشأنه، ولا تُشارك مع أطراف أخرى لأغراض تسويقية.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={orderingDisabled || belowMin}
        >
          {orderingDisabled
            ? "الفرع مغلق — لا يمكن إرسال الطلب"
            : belowMin
              ? "أضف أصنافاً للوصول للحد الأدنى"
              : t.submitOrder}
        </Button>
      </form>

      {mapsEnabled && (
        <LocationPickerModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          initialLocation={location}
          onConfirm={(next) => {
            setLocation(next);
            setLocationError(null);
            toast.success("تم تحديد الموقع");
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (loading) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          void submitOrder();
        }}
        title={t.deliveryPaidConfirmTitle}
        message={t.deliveryPaidConfirmMessage}
        confirmLabel={t.deliveryPaidConfirmOk}
        danger={false}
        loading={loading}
      />
    </div>
  );
}
