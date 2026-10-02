"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTimeAr, formatPrice } from "@/lib/utils";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import type { PublicTrackingPayload } from "@/lib/order-lookup";
import type { OrderType } from "@/types/database";

const orderTypeLabels: Record<OrderType, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "داخل المطعم",
};

export function OrderTrackingClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicTrackingPayload;
}) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/order-tracking/${token}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as PublicTrackingPayload & {
          error?: string;
        };
        if (!cancelled && !json.error) setData(json);
      } catch {
        // ignore transient network errors
      }
    }

    const id = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  if (data.expired) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-stone-900">انتهت صلاحية التتبع</h1>
        <p className="mt-2 text-sm text-stone-500">
          رابط التتبع متاح لمدة 7 أيام بعد التسليم أو الإلغاء.
        </p>
      </main>
    );
  }

  const courier =
    data.status === "on_the_way" && data.courier?.name
      ? data.courier
      : null;
  const waDigits = courier?.phone
    ? normalizeWhatsappNumber(courier.phone)
    : null;

  return (
    <main className="mx-auto max-w-md px-4 py-10" dir="rtl">
      <p className="text-sm text-stone-500">{data.branchName}</p>
      <h1 className="mt-1 text-2xl font-bold text-stone-900">تتبع الطلب</h1>
      <p className="mt-2 text-lg font-semibold" dir="ltr">
        {data.orderNumber}
      </p>
      <div className="mt-4">
        <StatusBadge status={data.status} />
      </div>
      <p className="mt-2 text-sm text-stone-600">{data.statusLabel}</p>

      {courier && (
        <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-brand-900">موظف التوصيل</h2>
          <p className="mt-2 text-base font-semibold text-stone-900">
            {courier.name}
          </p>
          {courier.phone && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${courier.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm ring-1 ring-stone-200"
              >
                <Phone className="h-4 w-4" />
                اتصال
              </a>
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                >
                  واتساب
                </a>
              )}
            </div>
          )}
        </section>
      )}

      <div className="mt-6 space-y-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <p>
          <strong>النوع:</strong> {orderTypeLabels[data.orderType]}
        </p>
        <p>
          <strong>وقت الطلب:</strong> {formatDateTimeAr(data.createdAt)}
        </p>
        <div className="border-t border-stone-100 pt-2" dir="ltr">
          <p className="flex justify-between">
            <span>المجموع الفرعي</span>
            <span>{formatPrice(data.subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span>رسوم التوصيل</span>
            <span>{formatPrice(data.deliveryFee)}</span>
          </p>
          <p className="flex justify-between font-bold">
            <span>المجموع</span>
            <span>{formatPrice(data.total)}</span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-stone-400">
        يتم تحديث الحالة تلقائياً كل 15 ثانية. لا تُعرض بياناتك الشخصية هنا.
      </p>
    </main>
  );
}
