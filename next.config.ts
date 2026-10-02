import type { NextConfig } from "next";

/**
 * Security headers + CSP.
 *
 * Nonce for scripts: Next.js App Router inline/bootstrap scripts are not easily
 * covered by a single middleware nonce without breaking RSC streaming. We therefore
 * allow 'unsafe-inline' for script-src/style-src and document that here. Prefer
 * tightening later with Next nonce support when stable for this app's Maps + RSC mix.
 *
 * CSP starts enforceable; Maps + Supabase realtime + Storage are allowlisted.
 */

function supabaseHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function siteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const sbHost = supabaseHostname();
const supabaseHttps = sbHost ? `https://${sbHost}` : "https://*.supabase.co";
const supabaseWss = sbHost ? `wss://${sbHost}` : "wss://*.supabase.co";
const supabaseImgHost = sbHost ?? "*.supabase.co";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.googleapis.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https://${supabaseImgHost} https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `connect-src 'self' ${supabaseHttps} ${supabaseWss} https://maps.googleapis.com https://*.googleapis.com`,
  `frame-src 'none'`,
  `frame-ancestors 'none'`,
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
  // Enforce CSP (Maps + Supabase allowlisted). See comment above re: unsafe-inline.
  { key: "Content-Security-Policy", value: csp },
];

const allowedActionOrigins = [
  siteOrigin() ? new URL(siteOrigin()!).host : null,
  "localhost:3000",
  "127.0.0.1:3000",
].filter(Boolean) as string[];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins:
        allowedActionOrigins.length > 0 ? allowedActionOrigins : undefined,
      bodySizeLimit: "1mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImgHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
