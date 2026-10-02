import type { OrderStatus, OrderType } from "@/types/database";

/** Minimal order fields used by the notification bell (no phone/coords). */
export type PendingOrderSummary = {
  id: string;
  order_number: string;
  branch_id: string;
  branch_name?: string | null;
  total: number;
  status: OrderStatus;
  order_type: OrderType;
  assigned_to: string | null;
  deleted_at: string | null;
  created_at: string;
};

export function isStaffPendingOrder(
  order: PendingOrderSummary,
  branchIds: string[],
  ignoredIds: Set<string>
): boolean {
  if (order.deleted_at) return false;
  if (ignoredIds.has(order.id)) return false;
  if (order.order_type !== "delivery") return false;
  if (order.status !== "ready") return false;
  if (order.assigned_to) return false;
  return branchIds.includes(order.branch_id);
}

export function isAdminPendingOrder(order: PendingOrderSummary): boolean {
  if (order.deleted_at) return false;
  return order.status === "new";
}

export function applyPendingOrderChange(args: {
  role: "staff" | "admin";
  pending: PendingOrderSummary[];
  incoming: PendingOrderSummary;
  branchIds: string[];
  ignoredIds: Set<string>;
}): {
  pending: PendingOrderSummary[];
  shouldRing: boolean;
  removed: boolean;
} {
  const { role, incoming, branchIds, ignoredIds } = args;
  const without = args.pending.filter((o) => o.id !== incoming.id);

  const qualifies =
    role === "staff"
      ? isStaffPendingOrder(incoming, branchIds, ignoredIds)
      : isAdminPendingOrder(incoming);

  if (!qualifies) {
    return {
      pending: without,
      shouldRing: false,
      removed: without.length < args.pending.length,
    };
  }

  const wasPresent = args.pending.some((o) => o.id === incoming.id);
  const next = [...without, incoming].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  return {
    pending: next,
    shouldRing: !wasPresent,
    removed: false,
  };
}

export function minutesSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60_000));
}

export function tabTitleForPending(
  count: number,
  role: "staff" | "admin",
  baseTitle: string
): string {
  if (count <= 0) return baseTitle;
  const label = role === "admin" ? "طلبات جديدة" : "طلبات جاهزة";
  return `(${count}) ${label}`;
}
