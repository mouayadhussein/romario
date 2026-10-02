/**
 * Pure helpers for public order lookup / tracking (no secrets, unit-testable).
 */

import type { OrderStatus, OrderType } from "@/types/database";

export const ORDER_LOOKUP_FAIL_MESSAGE =
  "لم نعثر على طلب بهذا الرقم. تأكد من رقم الطلب";

const TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Normalize customer-entered order number to ORD-#### (at least 4 digits). */
export function normalizeOrderNumber(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.replace(/^ORD[-\s]*/i, "");
  const digits = withoutPrefix.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > 12) return null;
  const padded = digits.padStart(4, "0");
  return `ORD-${padded}`;
}

/** Digits only, strip leading 00. */
export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }
  return digits;
}

/** Last 9 digits for matching (Syria-style / local). */
export function phoneLast9(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

export function phonesMatch(a: string, b: string): boolean {
  const left = phoneLast9(a);
  const right = phoneLast9(b);
  if (!left || !right) return false;
  return left === right;
}

export function isTrackingExpired(args: {
  status: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  now?: number;
}): boolean {
  if (args.status !== "delivered" && args.status !== "cancelled") return false;
  const end = args.deliveredAt ?? args.cancelledAt;
  if (!end) return false;
  const t = new Date(end).getTime();
  if (!Number.isFinite(t)) return false;
  return (args.now ?? Date.now()) - t > TRACKING_TTL_MS;
}

type Dated = { created_at: string };

/** Prefer newest by created_at when several rows match. */
export function pickLatestOrder<T extends Dated>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )[0]!;
}

export type PublicCourier = {
  name: string;
  phone: string | null;
};

export type PublicTrackingPayload = {
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
  courier?: PublicCourier;
};

/**
 * Build the public tracking JSON. Courier only when status === on_the_way.
 * Never includes customer PII or staff user_id.
 */
export function buildPublicTrackingPayload(args: {
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
  courier?: { full_name: string; phone: string | null } | null;
}): PublicTrackingPayload {
  const base: PublicTrackingPayload = {
    orderNumber: args.orderNumber,
    status: args.status,
    statusLabel: args.statusLabel,
    orderType: args.orderType,
    subtotal: args.subtotal,
    deliveryFee: args.deliveryFee,
    total: args.total,
    createdAt: args.createdAt,
    branchName: args.branchName,
    expired: args.expired,
  };

  if (args.status !== "on_the_way" || !args.courier?.full_name) {
    return base;
  }

  return {
    ...base,
    courier: {
      name: args.courier.full_name,
      phone: args.courier.phone?.trim() ? args.courier.phone.trim() : null,
    },
  };
}

/** Assert response body has no customer PII keys (for tests). */
export function trackingPayloadHasCustomerPii(
  body: Record<string, unknown>
): boolean {
  const banned = [
    "customer_phone",
    "customerPhone",
    "customer_address",
    "customerAddress",
    "customer_lat",
    "customerLat",
    "customer_lng",
    "customerLng",
    "customer_name",
    "customerName",
    "user_id",
    "userId",
    "assigned_to",
    "assignedTo",
  ];
  return banned.some((k) => k in body);
}
