import type { OrderStatus, OrderType } from "@/types/database";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "جديد",
  preparing: "قيد التحضير",
  ready: "جاهز",
  on_the_way: "بالطريق",
  delivered: "تم التوصيل",
  cancelled: "ملغى",
};

/** Admin-allowed manual transitions (staff uses claim/deliver/release RPCs). */
const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["on_the_way", "preparing", "cancelled"],
  on_the_way: ["delivered", "ready", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ADMIN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function adminStatusOptions(current: OrderStatus): OrderStatus[] {
  const next = ADMIN_TRANSITIONS[current] ?? [];
  return [current, ...next.filter((s) => s !== current)];
}

export type CancelReasonCode =
  | "customer_cancelled"
  | "no_answer"
  | "wrong_address"
  | "item_unavailable"
  | "fake_order"
  | "other";

export const CANCEL_REASON_OPTIONS: {
  code: CancelReasonCode;
  label: string;
}[] = [
  { code: "customer_cancelled", label: "الزبون ألغى" },
  { code: "no_answer", label: "لا يرد على الهاتف" },
  { code: "wrong_address", label: "عنوان خاطئ" },
  { code: "item_unavailable", label: "الصنف غير متوفر" },
  { code: "fake_order", label: "طلب وهمي" },
  { code: "other", label: "أخرى" },
];

export function cancelReasonLabel(code: string, custom?: string | null): string {
  const found = CANCEL_REASON_OPTIONS.find((o) => o.code === code);
  if (code === "other" && custom?.trim()) return custom.trim();
  return found?.label ?? custom?.trim() ?? code;
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export function orderTypeLabel(type: OrderType): string {
  if (type === "delivery") return "توصيل";
  if (type === "pickup") return "استلام";
  return "داخل المطعم";
}
