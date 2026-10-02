import { describe, expect, it } from "vitest";
import {
  branchSchema,
  categorySchema,
  createOrderSchema,
  itemSchema,
} from "@/lib/validations";

const SAMPLE_UUID = "11111111-1111-4111-8111-111111111111";
const SAMPLE_CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const validOpeningHours = {
  mon: [{ open: "09:00", close: "22:00" }],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

function repeat(ch: string, n: number): string {
  return ch.repeat(n);
}

describe("validation boundaries vs DB CHECKs (007)", () => {
  describe("createOrderSchema", () => {
    const baseOrder = {
      branchId: SAMPLE_UUID,
      customerName: "أحمد",
      customerPhone: "0912345678",
      orderType: "pickup" as const,
      items: [{ itemId: SAMPLE_UUID, quantity: 1, note: null }],
    };

    it("accepts min/max length at DB limits", () => {
      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          customerName: repeat("ا", 1),
          customerPhone: "12345678",
        }).success
      ).toBe(true);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          customerName: repeat("ا", 100),
          customerPhone: repeat("1", 20),
          customerAddress: repeat("ع", 300),
          generalNote: repeat("م", 500),
          orderType: "delivery",
          items: [
            {
              itemId: SAMPLE_UUID,
              quantity: 20,
              note: repeat("ن", 200),
            },
          ],
        }).success
      ).toBe(true);

      // Delivery with map location only (no text address)
      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          orderType: "delivery",
          customerAddress: null,
          customerLat: 33.5138,
          customerLng: 36.2765,
        }).success
      ).toBe(true);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          orderType: "dine_in",
          tableNumber: repeat("ط", 20),
        }).success
      ).toBe(true);
    });

    it("rejects values beyond DB limits before they reach the database", () => {
      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          customerName: repeat("ا", 101),
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          customerPhone: "1234567",
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          customerPhone: repeat("1", 21),
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          orderType: "delivery",
          customerAddress: repeat("ع", 301),
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          orderType: "delivery",
          customerAddress: null,
          customerLat: null,
          customerLng: null,
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          generalNote: repeat("م", 501),
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          orderType: "dine_in",
          tableNumber: repeat("ط", 21),
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          items: [{ itemId: SAMPLE_UUID, quantity: 21, note: null }],
        }).success
      ).toBe(false);

      expect(
        createOrderSchema.safeParse({
          ...baseOrder,
          items: [
            {
              itemId: SAMPLE_UUID,
              quantity: 1,
              note: repeat("ن", 201),
            },
          ],
        }).success
      ).toBe(false);
    });

    it("returns Arabic messages when over limit", () => {
      const nameResult = createOrderSchema.safeParse({
        ...baseOrder,
        customerName: repeat("ا", 101),
      });
      expect(nameResult.success).toBe(false);
      if (!nameResult.success) {
        expect(nameResult.error.issues[0]?.message).toMatch(/طويل|الاسم/);
      }

      const qtyResult = createOrderSchema.safeParse({
        ...baseOrder,
        items: [{ itemId: SAMPLE_UUID, quantity: 21, note: null }],
      });
      expect(qtyResult.success).toBe(false);
      if (!qtyResult.success) {
        expect(qtyResult.error.issues[0]?.message).toMatch(/20|كمية/);
      }
    });
  });

  describe("branchSchema", () => {
    const baseBranch = {
      name: "فرع وسط",
      slug: "wasat",
      opening_hours: validOpeningHours,
      timezone: "Asia/Damascus",
      ordering_mode: "auto" as const,
      is_active: true,
      sort_order: 0,
    };

    it("accepts lengths at DB limits", () => {
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          name: repeat("ف", 100),
          slug: repeat("a", 50),
          address: repeat("ع", 300),
          phone: repeat("1", 20),
          whatsapp_number: "905348271939",
          map_url: `https://www.google.com/maps?q=${repeat("1", 400)}`,
          working_hours: repeat("س", 200),
        }).success
      ).toBe(true);
    });

    it("rejects lengths beyond DB limits", () => {
      expect(
        branchSchema.safeParse({ ...baseBranch, name: repeat("ف", 101) })
          .success
      ).toBe(false);
      expect(
        branchSchema.safeParse({ ...baseBranch, slug: repeat("a", 51) })
          .success
      ).toBe(false);
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          address: repeat("ع", 301),
        }).success
      ).toBe(false);
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          phone: repeat("1", 21),
        }).success
      ).toBe(false);
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          whatsapp_number: repeat("9", 26),
        }).success
      ).toBe(false);
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          map_url: `https://example.com/${repeat("x", 500)}`,
        }).success
      ).toBe(false);
      expect(
        branchSchema.safeParse({
          ...baseBranch,
          working_hours: repeat("س", 201),
        }).success
      ).toBe(false);
    });
  });

  describe("categorySchema / itemSchema", () => {
    it("accepts names/descriptions/urls at DB limits", () => {
      expect(
        categorySchema.safeParse({
          branch_id: SAMPLE_UUID,
          name: repeat("ص", 100),
          image_url: `https://example.supabase.co/storage/v1/object/public/menu-images/${repeat("a", 100)}.jpg`,
          is_active: true,
          sort_order: 0,
        }).success
      ).toBe(true);

      expect(
        itemSchema.safeParse({
          category_id: SAMPLE_CATEGORY_ID,
          name: repeat("و", 100),
          description: repeat("و", 500),
          price: 10,
          image_url: `https://example.supabase.co/storage/v1/object/public/menu-images/${repeat("b", 100)}.jpg`,
          is_available: true,
          sort_order: 0,
        }).success
      ).toBe(true);
    });

    it("rejects over DB limits", () => {
      expect(
        categorySchema.safeParse({
          branch_id: SAMPLE_UUID,
          name: repeat("ص", 101),
          is_active: true,
          sort_order: 0,
        }).success
      ).toBe(false);

      expect(
        categorySchema.safeParse({
          branch_id: SAMPLE_UUID,
          name: "صنف",
          image_url: `https://example.com/${repeat("x", 500)}`,
          is_active: true,
          sort_order: 0,
        }).success
      ).toBe(false);

      expect(
        itemSchema.safeParse({
          category_id: SAMPLE_CATEGORY_ID,
          name: repeat("و", 101),
          price: 1,
          is_available: true,
          sort_order: 0,
        }).success
      ).toBe(false);

      expect(
        itemSchema.safeParse({
          category_id: SAMPLE_CATEGORY_ID,
          name: "وجبة",
          description: repeat("د", 501),
          price: 1,
          is_available: true,
          sort_order: 0,
        }).success
      ).toBe(false);
    });
  });
});
