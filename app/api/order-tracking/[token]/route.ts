import { NextResponse } from "next/server";
import { createServiceClient } from "@/supabase/admin";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus, OrderType } from "@/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isExpired(
  status: OrderStatus,
  deliveredAt: string | null,
  cancelledAt: string | null
) {
  if (status !== "delivered" && status !== "cancelled") return false;
  const end = deliveredAt ?? cancelledAt;
  if (!end) return false;
  return Date.now() - new Date(end).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const admin = createServiceClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "order_number, status, order_type, subtotal, delivery_fee, total, created_at, delivered_at, cancelled_at, deleted_at, branches(name)"
    )
    .eq("tracking_token", token)
    .maybeSingle();

  if (!order || order.deleted_at) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const status = order.status as OrderStatus;
  const expired = isExpired(status, order.delivered_at, order.cancelled_at);
  const branchName =
    (order.branches as { name: string } | null)?.name ?? "المطعم";

  return NextResponse.json(
    {
      orderNumber: order.order_number,
      status,
      statusLabel: ORDER_STATUS_LABELS[status] ?? status,
      orderType: order.order_type as OrderType,
      subtotal: Number(order.subtotal ?? order.total),
      deliveryFee: Number(order.delivery_fee ?? 0),
      total: Number(order.total),
      createdAt: order.created_at,
      branchName,
      expired,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
