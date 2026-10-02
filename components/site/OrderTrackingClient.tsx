"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTimeAr, formatPrice } from "@/lib/utils";
import type { OrderStatus, OrderType } from "@/types/database";

type TrackingPayload = {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  orderType: OrderType;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  branchName: string;
  expired: boolean;
};

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
  initial: TrackingPayload;
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
        const json = (await res.json()) as TrackingPayload & { error?: string };
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
