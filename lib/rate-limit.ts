import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { config } from "@/lib/config";
import { getEnv, hasUpstash } from "@/lib/env";
import { logger } from "@/lib/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

let warnedMissingUpstash = false;
let redisClient: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (!hasUpstash()) return null;
  if (redisClient) return redisClient;
  const env = getEnv();
  redisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redisClient;
}

function getLimiter(name: string, max: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${name}:${max}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${seconds} s`),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

function memoryCheck(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Distributed rate limit when Upstash is configured; otherwise in-memory fallback.
 * In production without Upstash: still enforces per-instance memory limit and logs a warning once.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = config.rateLimit.maxRequests,
  windowMs: number = config.rateLimit.windowMs
): Promise<{ allowed: boolean; remaining: number; backend: "upstash" | "memory" }> {
  const limiter = getLimiter("default", maxRequests, windowMs);

  if (!limiter) {
    if (getEnv().NODE_ENV === "production" && !warnedMissingUpstash) {
      warnedMissingUpstash = true;
      logger.warn(
        "UPSTASH_REDIS_REST_URL/TOKEN missing — using in-memory rate limit (not shared across serverless instances)"
      );
    }
    const result = memoryCheck(key, maxRequests, windowMs);
    return { ...result, backend: "memory" };
  }

  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    backend: "upstash",
  };
}

/** Login: 5 attempts / 15 minutes per key (IP or email). */
export async function checkLoginRateLimit(key: string) {
  return checkRateLimit(`login:${key}`, 5, 15 * 60_000);
}

/** Orders: 10 / minute per IP (config default). */
export async function checkOrderIpRateLimit(ip: string) {
  return checkRateLimit(`orders:ip:${ip}`);
}

/** Orders: 5 / hour per phone number. */
export async function checkOrderPhoneRateLimit(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return checkRateLimit(`orders:phone:${normalized}`, 5, 60 * 60_000);
}

/** Order lookup: 10 attempts / 10 minutes per IP. */
export async function checkLookupIpRateLimit(ip: string) {
  return checkRateLimit(`lookup:ip:${ip}`, 10, 10 * 60_000);
}

/** Order lookup: 5 attempts / hour per phone (digits). */
export async function checkLookupPhoneRateLimit(phoneDigits: string) {
  const normalized = phoneDigits.replace(/\D/g, "");
  return checkRateLimit(`lookup:phone:${normalized}`, 5, 60 * 60_000);
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 60_000).unref?.();
}
