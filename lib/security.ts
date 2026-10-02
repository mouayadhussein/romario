import "server-only";

import { getAllowedOrigins, getEnv, getSupabaseHostname } from "@/lib/env";

const MAX_BODY_BYTES = 32 * 1024; // 32 KiB

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Reject cross-origin POSTs in production when an Origin header is present.
 * Same-origin browser requests send Origin; some non-browser clients may omit it.
 */
export function assertAllowedOrigin(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Allow missing Origin for same-site navigations / non-browser; Host still checked lightly.
    const host = request.headers.get("host");
    const site = getEnv().NEXT_PUBLIC_SITE_URL;
    if (site && host && getEnv().NODE_ENV === "production") {
      try {
        const siteHost = new URL(site).host;
        if (host !== siteHost && !host.endsWith(".vercel.app")) {
          return { ok: false, status: 403, error: "طلب غير مسموح" };
        }
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  }

  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    // SITE_URL not set — allow in non-production; in production require SITE_URL
    if (getEnv().NODE_ENV === "production") {
      return { ok: false, status: 403, error: "طلب غير مسموح" };
    }
    return { ok: true };
  }

  if (!allowed.includes(origin)) {
    // Also allow *.vercel.app preview hosts matching the deployment host
    try {
      const o = new URL(origin);
      const host = request.headers.get("host");
      if (host && o.host === host && o.host.endsWith(".vercel.app")) {
        return { ok: true };
      }
    } catch {
      /* fall through */
    }
    return { ok: false, status: 403, error: "طلب غير مسموح" };
  }

  return { ok: true };
}

export function assertBodySize(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const raw = request.headers.get("content-length");
  if (raw) {
    const len = Number(raw);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: "حجم الطلب كبير جداً" };
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
