import "server-only";

import { getAllowedOrigins, getEnv, getSupabaseHostname } from "@/lib/env";
import { logger } from "@/lib/logger";

const MAX_BODY_BYTES = 32 * 1024; // 32 KiB

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function requestHost(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get("host")?.trim() || null;
}

/**
 * CSRF-ish check: allow same-host Origin (page and API on the same deployment),
 * plus configured SITE_URL / localhost. Reject only true cross-site requests.
 */
export function assertAllowedOrigin(
  request: Request
): { ok: true } | { ok: false; status: number; error: string } {
  const origin = request.headers.get("origin");
  const host = requestHost(request);

  // Browser same-origin fetch usually sends Origin. Missing Origin is OK for
  // non-browser clients; Host is still validated lightly in production.
  if (!origin) {
    if (getEnv().NODE_ENV === "production" && host) {
      const site = getEnv().NEXT_PUBLIC_SITE_URL;
      if (site) {
        try {
          const siteHost = new URL(site).host;
          const ok =
            host === siteHost ||
            host.endsWith(".vercel.app") ||
            host === "localhost:3000" ||
            host === "127.0.0.1:3000";
          if (!ok) {
            logger.warn("orders.origin_host_mismatch", { reason: "no_origin" });
            return {
              ok: false,
              status: 403,
              error:
                "لا يمكن إرسال الطلب من هذا العنوان. افتح الموقع من الرابط الرسمي ثم أعد المحاولة.",
            };
          }
        } catch {
          /* ignore bad SITE_URL */
        }
      }
    }
    return { ok: true };
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return {
      ok: false,
      status: 403,
      error: "طلب غير صالح من مصدر غير معروف. حدّث الصفحة ثم أعد المحاولة.",
    };
  }

  // Primary: Origin matches this deployment's Host (works for custom domain + vercel.app)
  if (host && originHost === host) {
    return { ok: true };
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    return { ok: true };
  }

  // Preview / alternate vercel host matching the request Host was already covered.
  // Allow configured SITE_URL host even if scheme/port string differs slightly.
  const site = getEnv().NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      if (originHost === new URL(site).host) {
        return { ok: true };
      }
    } catch {
      /* ignore */
    }
  }

  if (getEnv().NODE_ENV !== "production") {
    if (
      originHost === "localhost:3000" ||
      originHost === "127.0.0.1:3000" ||
      originHost.startsWith("localhost:") ||
      originHost.startsWith("127.0.0.1:")
    ) {
      return { ok: true };
    }
  }

  logger.warn("orders.origin_rejected", { reason: "cross_origin" });
  return {
    ok: false,
    status: 403,
    error:
      "لا يمكن إرسال الطلب من موقع آخر. افتح المتجر من الرابط الرسمي ثم أكّد الطلب من جديد.",
  };
}

export function assertBodySize(
  request: Request
): { ok: true } | { ok: false; status: number; error: string } {
  const raw = request.headers.get("content-length");
  if (raw) {
    const len = Number(raw);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        error:
          "حجم بيانات الطلب كبير جداً. قلّل الملاحظات أو عدد الأصناف ثم أعد المحاولة.",
      };
    }
  }
  return { ok: true };
}

/** Validate stored image URLs belong to our Supabase Storage public bucket. */
export function isAllowedImageUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = getSupabaseHostname();
    if (u.hostname !== host) return false;
    return u.pathname.includes("/storage/v1/object/public/menu-images/");
  } catch {
    return false;
  }
}

/** Validate map URLs are Google Maps links (or empty). */
export function isAllowedMapUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./, "");
    return (
      host === "google.com" ||
      host === "maps.google.com" ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl"
    );
  } catch {
    return false;
  }
}

export const ORDER_MAX_BODY_BYTES = MAX_BODY_BYTES;
