import "server-only";

import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

/** Public origin for auth redirects and emails (no trailing slash). */
export async function resolveSiteOrigin(): Promise<string> {
  const env = getEnv();
  const configured = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const vercelHost = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercelHost) return `https://${vercelHost}`;

  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host")?.trim();
  if (host) {
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    if (!isLocal || env.NODE_ENV === "development") {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  }

  if (env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "Set NEXT_PUBLIC_SITE_URL to your production URL (e.g. https://dibo-restaurant.vercel.app)"
  );
}
