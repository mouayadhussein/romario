import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  normalizeWhatsappNumber,
  truncateText,
} from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("keeps a clean international number", () => {
    expect(normalizeWhatsappNumber("905348271939")).toBe("905348271939");
  });

  it("strips + spaces and dashes", () => {
    expect(normalizeWhatsappNumber("+90 534 827 1939")).toBe("905348271939");
    expect(normalizeWhatsappNumber("+90-534-827-1939")).toBe("905348271939");
  });

  it("strips leading 00", () => {
    expect(normalizeWhatsappNumber("00905348271939")).toBe("905348271939");
    expect(normalizeWhatsappNumber("00 90 534 827 1939")).toBe("905348271939");
  });

  it("rejects too short or too long", () => {
    expect(normalizeWhatsappNumber("1234567")).toBeNull();
    expect(normalizeWhatsappNumber("1234567890123456")).toBeNull();
  });

  it("rejects empty / non-numeric", () => {
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("abc")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
  });
});

describe("truncateText", () => {
  it("truncates by code points without producing replacement chars", () => {
    const text = "مرحباً بالعالم";
    const cut = truncateText(text, 5);
    expect(cut).toBe(Array.from(text).slice(0, 5).join(""));
    expect(cut.includes("\uFFFD")).toBe(false);
  });
});

describe("buildWhatsAppUrl", () => {
  it("encodes message once and normalizes number", () => {
    const msg = buildWhatsAppMessage({
      orderNumber: "A-1",
      customerName: "أحمد",
      customerPhone: "0999",
      orderType: "delivery",
      customerAddress: "دمشق",
      items: [{ name: "شاورما", quantity: 1, price: 10 }],
      total: 10,
      branchName: "الفرع",
    });
    const url = buildWhatsAppUrl("+90 534 827 1939", msg);
    expect(url).toMatch(/^https:\/\/wa\.me\/905348271939\?text=/);
    expect(url).not.toContain("%25"); // not double-encoded
    expect(decodeURIComponent(url!.split("text=")[1]!)).toContain("طلب جديد");
    expect(decodeURIComponent(url!.split("text=")[1]!)).not.toContain("🍽️");
  });
});
