import { describe, expect, it } from "vitest";
import {
  applyPendingOrderChange,
  isAdminPendingOrder,
  isStaffPendingOrder,
  tabTitleForPending,
  type PendingOrderSummary,
} from "@/lib/notifications/pending-orders";

function base(over: Partial<PendingOrderSummary> = {}): PendingOrderSummary {
  return {
    id: "o1",
    order_number: "A-1",
    branch_id: "b1",
    total: 100,
    status: "ready",
    order_type: "delivery",
    assigned_to: null,
    deleted_at: null,
    created_at: "2026-01-01T10:00:00.000Z",
    ...over,
  };
}

describe("pending order counter logic", () => {
  it("adds a qualifying staff ready order", () => {
    const r = applyPendingOrderChange({
      role: "staff",
      pending: [],
      incoming: base(),
      branchIds: ["b1"],
      ignoredIds: new Set(),
    });
    expect(r.pending).toHaveLength(1);
    expect(r.shouldRing).toBe(true);
  });

  it("does not ring when order already in pending", () => {
    const order = base();
    const r = applyPendingOrderChange({
      role: "staff",
      pending: [order],
      incoming: order,
      branchIds: ["b1"],
      ignoredIds: new Set(),
    });
    expect(r.pending).toHaveLength(1);
    expect(r.shouldRing).toBe(false);
  });

  it("removes when claimed by another staff", () => {
    const pending = [base()];
    const r = applyPendingOrderChange({
      role: "staff",
      pending,
      incoming: base({ assigned_to: "other", status: "on_the_way" }),
      branchIds: ["b1"],
      ignoredIds: new Set(),
    });
    expect(r.pending).toHaveLength(0);
    expect(r.removed).toBe(true);
    expect(r.shouldRing).toBe(false);
  });

  it("hides ignored orders for this staff only", () => {
    expect(
      isStaffPendingOrder(base(), ["b1"], new Set(["o1"]))
    ).toBe(false);
    const r = applyPendingOrderChange({
      role: "staff",
      pending: [base()],
      incoming: base(),
      branchIds: ["b1"],
      ignoredIds: new Set(["o1"]),
    });
    expect(r.pending).toHaveLength(0);
  });

  it("admin pending is status=new only", () => {
    expect(isAdminPendingOrder(base({ status: "new" }))).toBe(true);
    expect(isAdminPendingOrder(base({ status: "ready" }))).toBe(false);
  });

  it("reconnect-style replace keeps count correct after claim", () => {
    const a = base({ id: "a", created_at: "2026-01-01T09:00:00.000Z" });
    const b = base({ id: "b", created_at: "2026-01-01T09:05:00.000Z" });
    let pending = [a, b];
    pending = applyPendingOrderChange({
      role: "staff",
      pending,
      incoming: { ...a, assigned_to: "x", status: "on_the_way" },
      branchIds: ["b1"],
      ignoredIds: new Set(),
    }).pending;
    expect(pending.map((p) => p.id)).toEqual(["b"]);
  });

  it("builds tab title", () => {
    expect(tabTitleForPending(0, "admin", "ديبو")).toBe("ديبو");
    expect(tabTitleForPending(2, "admin", "ديبو")).toBe("(2) طلبات جديدة");
    expect(tabTitleForPending(1, "staff", "ديبو")).toBe("(1) طلبات جاهزة");
  });
});
