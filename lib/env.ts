import "server-only";
import { z } from "zod";

/**
 * Server-side environment validation.
 * Fails fast with a clear message when required secrets/config are missing.
 * Optional vars (Upstash, Google Maps, Sentry) are validated when present.
 */

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is required"),

  NEXT_PUBLIC_SITE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL").optional()
  ),

  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  NEXT_PUBLIC_GOOGLE_MAP_ID: z.preprocess(emptyToUndefined, z.string().optional()),

  UPSTASH_REDIS_REST_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional()
  ),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),

  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),

  /** Retention months for PII anonymization (used by docs / scheduled jobs). */
  CUSTOMER_PII_RETENTION_MONTHS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(120).optional()
  ),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatZodError(parsed.error)}\n` +
        `See SECURITY.md and README for required variables.`
    );
  }

  cached = parsed.data;
  return cached;
}

/** Allowed web origins for CSRF-ish Origin checks and serverActions. */
export function getAllowedOrigins(): string[] {
  const env = getEnv();
  const origins = new Set<string>();

  if (env.NEXT_PUBLIC_SITE_URL) {
    origins.add(new URL(env.NEXT_PUBLIC_SITE_URL).origin);
  }

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return [...origins];
}

export function getSupabaseHostname(): string {
  return new URL(getEnv().NEXT_PUBLIC_SUPABASE_URL).hostname;
}

export function hasUpstash(): boolean {
  const env = getEnv();
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
