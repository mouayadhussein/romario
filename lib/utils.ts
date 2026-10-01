import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2)} ${config.currencySymbol}`;
}

export function sanitizeNote(note: string | null | undefined, maxLength = 200): string | null {
  if (!note) return null;
  const cleaned = Array.from(
    note
      .replace(/[<>]/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
  )
    .slice(0, maxLength)
    .join("");
  return cleaned.length > 0 ? cleaned : null;
}

/** Simple Arabic → Latin map for slug generation */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "th",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "h",
  ء: "",
  ئ: "y",
  ؤ: "w",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function randomSlugSuffix(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Convert a name to a URL-safe slug (a-z, 0-9, hyphens only).
 * English names are lowercased; Arabic is lightly latinized;
 * if nothing usable remains, a short random slug is returned.
 */
export function slugify(text: string): string {
  const latinized = Array.from(text.trim())
    .map((ch) => {
      if (ARABIC_TO_LATIN[ch] !== undefined) return ARABIC_TO_LATIN[ch];
      return ch;
    })
    .join("");

  const slug = latinized
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return slug || `b-${randomSlugSuffix()}`;
}

/** Ensure slug uniqueness by appending -2, -3, … when needed. */
export function uniquifySlug(
  base: string,
  existing: Iterable<string>,
  exclude?: string
): string {
  const taken = new Set(
    [...existing].filter((s) => s && s !== exclude).map((s) => s.toLowerCase())
  );
  let candidate = base.slice(0, 50) || `b-${randomSlugSuffix()}`;
  if (!taken.has(candidate)) return candidate;

  let n = 2;
  while (n < 1000) {
    const suffix = `-${n}`;
    candidate = `${base.slice(0, Math.max(1, 50 - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
  }
  return `${base.slice(0, 40)}-${randomSlugSuffix()}`;
}
