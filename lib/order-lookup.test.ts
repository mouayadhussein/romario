import { describe, expect, it } from "vitest";
import {
  ORDER_LOOKUP_FAIL_MESSAGE,
  buildPublicTrackingPayload,
  isTrackingExpired,
  normalizeOrderNumber,
  normalizePhoneDigits,
  phoneLast9,
  phonesMatch,
  pickLatestOrder,
  trackingPayloadHasCustomerPii,
} from "@/lib/order-lookup";

describe("normalizeOrderNumber", () => {
  it("accepts ORD-0003, 0003, and 3", () => {
    expect(normalizeOrderNumber("ORD-0003")).toBe("ORD-0003");
    expect(normalizeOrderNumber("ord-0003")).toBe("ORD-0003");
    expect(normalizeOrderNumber("0003")).toBe("ORD-0003");
    expect(normalizeOrderNumber("3")).toBe("ORD-0003");
    expect(normalizeOrderNumber(" 12 ")).toBe("ORD-0012");
  });

  it("rejects empty / non-numeric", () => {
    expect(normalizeOrderNumber("")).toBeNull();
    expect(normalizeOrderNumber("ORD-")).toBeNull();
    expect(normalizeOrderNumber("abc")).toBeNull();
  });
});

describe("phone matching", () => {
  it("strips non-digits and leading 00", () => {
    expect(normalizePhoneDigits("00963 944 123456")).toBe("963944123456");
    expect(normalizePhoneDigits("+963-944-123456")).toBe("963944123456");
  });

  it("matches on last 9 digits", () => {
    expect(phoneLast9("0944123456")).toBe("944123456");
    expect(phoneLast9("963944123456")).toBe("944123456");
    expect(phonesMatch("0944 123 456", "00963944123456")).toBe(true);
    expect(phonesMatch("0944123456", "0944999999")).toBe(false);
  });
});

describe("pickLatestOrder", () => {
  it("chooses the newest created_at", () => {
    const latest = pickLatestOrder([
      { id: "a", created_at: "2026-01-01T10:00:00.000Z" },
      { id: "b", created_at: "2026-02-01T10:00:00.000Z" },
      { id: "c", created_at: "2026-01-15T10:00:00.000Z" },
    ]);
    expect(latest?.id).toBe("b");
  });
});

describe("ORDER_LOOKUP_FAIL_MESSAGE", () => {
  it("is a single stable Arabic message", () => {
    expect(ORDER_LOOKUP_FAIL_MESSAGE).toContain("لم نعثر");
    expect(ORDER_LOOKUP_FAIL_MESSAGE).toContain("رقم الطلب");
  });
});

describe("tracking expiry", () => {
  it("expires 7 days after delivery/cancel", () => {
    const now = Date.parse("2026-02-10T00:00:00.000Z");
    expect(
      isTrackingExpired({
        status: "delivered",
        deliveredAt: "2026-02-01T00:00:00.000Z",
        cancelledAt: null,
        now,
      })
    ).toBe(true);
    expect(
      isTrackingExpired({
        status: "delivered",
        deliveredAt: "2026-02-08T00:00:00.000Z",
        cancelledAt: null,
        now,
      })
    ).toBe(false);
    expect(
      isTrackingExpired({
        status: "preparing",
        deliveredAt: null,
        cancelledAt: null,
        now,
      })
    ).toBe(false);
  });
});

describe("buildPublicTrackingPayload", () => {
  const base = {
    orderNumber: "ORD-0001",
    status: "preparing" as const,
    statusLabel: "قيد التحضير",
    orderType: "delivery" as const,
    subtotal: 100,
    deliveryFee: 10,
    total: 110,
    createdAt: "2026-01-01T00:00:00.000Z",
    branchName: "فرع",
    expired: false,
  };

  it("omits courier unless on_the_way", () => {
    const preparing = buildPublicTrackingPayload({
      ...base,
      courier: { full_name: "أحمد", phone: "0944" },
    });
    expect(preparing).not.toHaveProperty("courier");

    const onWay = buildPublicTrackingPayload({
      ...base,
      status: "on_the_way",
      statusLabel: "بالطريق",
      courier: { full_name: "أحمد", phone: "0944123456" },
    });
    expect(onWay.courier).toEqual({ name: "أحمد", phone: "0944123456" });

    const delivered = buildPublicTrackingPayload({
      ...base,
      status: "delivered",
      statusLabel: "تم التسليم",
      courier: { full_name: "أحمد", phone: "0944" },
    });
    expect(delivered).not.toHaveProperty("courier");
  });

  it("never exposes customer PII keys", () => {
    const body = buildPublicTrackingPayload({
      ...base,
      status: "on_the_way",
      courier: { full_name: "سامي", phone: null },
    }) as Record<string, unknown>;
    expect(trackingPayloadHasCustomerPii(body)).toBe(false);
    expect(body).not.toHaveProperty("user_id");
    expect(body.courier).toEqual({ name: "سامي", phone: null });
  });
});
