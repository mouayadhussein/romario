import { formatPrice } from "./utils";
import type { OrderType } from "@/types/database";

interface WhatsAppOrderItem {
  name: string;
  quantity: number;
  price: number;
  note?: string | null;
}

interface WhatsAppOrderPayload {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  orderType: OrderType;
  tableNumber?: string | null;
  generalNote?: string | null;
  items: WhatsAppOrderItem[];
  total: number;
  branchName: string;
}

const orderTypeLabels: Record<OrderType, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "داخل المطعم",
};

/** Truncate by Unicode code points (safe for emoji / Arabic). */
export function truncateText(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return chars.slice(0, maxLength).join("");
}

/**
 * Normalize a WhatsApp number for wa.me links:
 * digits only, strip leading 00, length 8–15.
 * Returns null if invalid.
 */
export function normalizeWhatsappNumber(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function buildWhatsAppMessage(payload: WhatsAppOrderPayload): string {
  const lines: string[] = [
    `طلب جديد — ${payload.branchName}`,
    `رقم الطلب: ${payload.orderNumber}`,
    ``,
    `الزبون: ${payload.customerName}`,
    `الهاتف: ${payload.customerPhone}`,
    `النوع: ${orderTypeLabels[payload.orderType]}`,
  ];

  if (payload.orderType === "delivery" && payload.customerAddress) {
    lines.push(`العنوان: ${payload.customerAddress}`);
  }
  if (
    payload.orderType === "delivery" &&
    payload.customerLat != null &&
    payload.customerLng != null
  ) {
    lines.push(
      `الموقع: https://www.google.com/maps?q=${payload.customerLat},${payload.customerLng}`
    );
  }
  if (payload.orderType === "dine_in" && payload.tableNumber) {
    lines.push(`الطاولة: ${payload.tableNumber}`);
  }

  lines.push(``, `—— الأصناف ——`);

  for (const item of payload.items) {
    let line = `- ${item.name} x ${item.quantity} — ${formatPrice(item.price * item.quantity)}`;
    if (item.note) {
      line += `\n  ملاحظة: ${truncateText(item.note, 200)}`;
    }
    lines.push(line);
  }

  if (payload.generalNote) {
    lines.push(
      ``,
      `ملاحظة عامة: ${truncateText(payload.generalNote, 500)}`
    );
  }

  lines.push(
    ``,
    `المجموع: ${formatPrice(payload.total)}`,
    `الدفع: نقداً عند الاستلام`
  );

  // Build full message first; encodeURIComponent is applied once in buildWhatsAppUrl
  return lines.join("\n");
}

export function buildWhatsAppUrl(
  whatsappNumber: string,
  message: string
): string | null {
  const number = normalizeWhatsappNumber(whatsappNumber);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
