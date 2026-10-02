import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/supabase/admin";
import { OrderTrackingClient } from "@/components/site/OrderTrackingClient";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus, OrderType } from "@/types/database";

export const metadata: Metadata = {
  title: "تتبع الطلب",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isExpired(status: OrderStatus, deliveredAt: string | null, cancelledAt: string | null) {
  if (status !== "delivered" && status !== "cancelled") return false;
  const end = deliveredAt ?? cancelledAt;
  if (!end) return false;
  const ms = Date.now() - new Date(end).getTime();
  return ms > 7 * 24 * 60 * 60 * 1000;
}

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const admin = createServiceClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "order_number, status, order_type, subtotal, delivery_fee, total, created_at, delivered_at, cancelled_at, deleted_at, branches(name)"
    )
    .eq("tracking_token", token)
    .maybeSingle();

  if (!order || order.deleted_at) notFound();

  const status = order.status as OrderStatus;
  if (isExpired(status, order.delivered_at, order.cancelled_at)) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-stone-900">انتهت صلاحية التتبع</h1>
        <p className="mt-2 text-sm text-stone-500">
          رابط التتبع متاح لمدة 7 أيام بعد التسليم أو الإلغاء.
        </p>
      </main>
    );
  }

  const branchName =
    (order.branches as { name: string } | null)?.name ?? "المطعم";

  return (
    <OrderTrackingClient
      token={token}
      initial={{
        orderNumber: order.order_number,
        status,
        statusLabel: ORDER_STATUS_LABELS[status] ?? status,
        orderType: order.order_type as OrderType,
        subtotal: Number(order.subtotal ?? order.total),
        deliveryFee: Number(order.delivery_fee ?? 0),
        total: Number(order.total),
        createdAt: order.created_at,
        branchName,
        expired: false,
      }}
    />
  );
}
