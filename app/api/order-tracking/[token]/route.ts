import { NextResponse } from "next/server";
import { createServiceClient } from "@/supabase/admin";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import {
  buildPublicTrackingPayload,
  isTrackingExpired,
} from "@/lib/order-lookup";
import type { OrderStatus, OrderType } from "@/types/database";

/** Never cache tracking responses — status changes (claim/deliver) must be live. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!UUID_RE.test(token)) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: NO_STORE }
    );
  }

  const admin = createServiceClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "order_number, status, order_type, subtotal, delivery_fee, total, created_at, delivered_at, cancelled_at, deleted_at, assigned_to, branches(name)"
    )
    .eq("tracking_token", token)
    .maybeSingle();

  if (!order || order.deleted_at) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: NO_STORE }
    );
  }

  const status = order.status as OrderStatus;
  const expired = isTrackingExpired({
    status,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
  });
  const branchName =
    (order.branches as { name: string } | null)?.name ?? "المطعم";

  let courier: { full_name: string; phone: string | null } | null = null;
  if (status === "on_the_way" && order.assigned_to) {
    const { data: staff } = await admin
      .from("staff")
      .select("full_name, phone")
      .eq("user_id", order.assigned_to)
      .maybeSingle();
    if (staff?.full_name) {
      courier = {
        full_name: staff.full_name,
        phone: staff.phone,
      };
    }
  }

  const payload = buildPublicTrackingPayload({
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
    courier,
  });

  return NextResponse.json(payload, { headers: NO_STORE });
}
