import { describe, expect, it } from "vitest";
import { calculateOrderFees } from "@/lib/order-fees";
import { canAdminTransition } from "@/lib/order-status";
import { calculateStaffCashBalance } from "@/lib/staff-cash";
import {
  STAFF_HAS_RECORDS_MSG,
  canHardDeleteStaff,
  staffHasRecords,
} from "@/lib/staff-guards";

describe("calculateOrderFees", () => {
  it("applies delivery fee only for delivery", () => {
    const delivery = calculateOrderFees({
      orderType: "delivery",
      subtotal: 100,
      deliveryFee: 15,
      minOrderAmount: 0,
      freeDeliveryThreshold: null,
    });
    expect(delivery.deliveryFee).toBe(15);
    expect(delivery.total).toBe(115);

    const pickup = calculateOrderFees({
      orderType: "pickup",
      subtotal: 100,
      deliveryFee: 15,
      minOrderAmount: 0,
      freeDeliveryThreshold: null,
    });
    expect(pickup.deliveryFee).toBe(0);
    expect(pickup.total).toBe(100);
  });

  it("applies free delivery threshold", () => {
    const r = calculateOrderFees({
      orderType: "delivery",
      subtotal: 200,
      deliveryFee: 20,
      minOrderAmount: 0,
      freeDeliveryThreshold: 150,
    });
    expect(r.deliveryFee).toBe(0);
    expect(r.freeDeliveryApplied).toBe(true);
    expect(r.total).toBe(200);
  });

  it("enforces min order shortfall", () => {
    const r = calculateOrderFees({
      orderType: "delivery",
      subtotal: 40,
      deliveryFee: 10,
      minOrderAmount: 50,
      freeDeliveryThreshold: null,
    });
    expect(r.minOrderOk).toBe(false);
    expect(r.minOrderShortfall).toBe(10);
  });
});

describe("canAdminTransition", () => {
  it("allows known paths and blocks illegal jumps", () => {
    expect(canAdminTransition("new", "preparing")).toBe(true);
    expect(canAdminTransition("preparing", "ready")).toBe(true);
    expect(canAdminTransition("ready", "on_the_way")).toBe(true);
    expect(canAdminTransition("new", "delivered")).toBe(false);
    expect(canAdminTransition("delivered", "new")).toBe(false);
  });
});

describe("calculateStaffCashBalance", () => {
  it("subtracts settlements from collections", () => {
    expect(
      calculateStaffCashBalance({
        collectedAmounts: [100, 50],
        settlementAmounts: [80],
      })
    ).toBe(70);
  });
});

describe("staff deletion guards", () => {
  it("blocks hard delete when staff has assigned orders or settlements", () => {
    expect(
      canHardDeleteStaff({ assignedOrderCount: 1, settlementCount: 0 })
    ).toBe(false);
    expect(
      canHardDeleteStaff({ assignedOrderCount: 0, settlementCount: 2 })
    ).toBe(false);
    expect(
      canHardDeleteStaff({ assignedOrderCount: 0, settlementCount: 0 })
    ).toBe(true);
    expect(staffHasRecords({ assignedOrderCount: 1, settlementCount: 0 })).toBe(
      true
    );
    expect(STAFF_HAS_RECORDS_MSG).toMatch(/تعطيله/);
  });
});
