import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/supabase/admin";
import { orderLookupSchema } from "@/lib/validations";
import {
  checkLookupIpRateLimit,
  checkLookupPhoneRateLimit,
} from "@/lib/rate-limit";
import {
  assertAllowedOrigin,
  assertBodySize,
  getClientIp,
} from "@/lib/security";
import {
  ORDER_LOOKUP_FAIL_MESSAGE,
  isTrackingExpired,
  normalizeOrderNumber,
  normalizePhoneDigits,
  phonesMatch,
  pickLatestOrder,
} from "@/lib/order-lookup";
import { logger } from "@/lib/logger";

const FAIL_MIN_MS = 220;

async function failResponse(startedAt: number) {
  const wait = FAIL_MIN_MS - (Date.now() - startedAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  return NextResponse.json(
    { error: ORDER_LOOKUP_FAIL_MESSAGE },
    { status: 404 }
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const originCheck = assertAllowedOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: originCheck.error },
        { status: originCheck.status }
      );
    }

    const sizeCheck = assertBodySize(request);
    if (!sizeCheck.ok) {
      return NextResponse.json(
        { error: sizeCheck.error },
        { status: sizeCheck.status }
      );
    }

    const ip = getClientIp(request);
    const ipLimit = await checkLookupIpRateLimit(ip);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "محاولات كثيرة جداً. انتظر قليلاً ثم أعد المحاولة.",
        },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failResponse(startedAt);
    }

    const parsed = orderLookupSchema.safeParse(body);
    if (!parsed.success) {
      return failResponse(startedAt);
    }

    const phoneDigits = normalizePhoneDigits(parsed.data.phone);
    if (phoneDigits.length < 9) {
      return failResponse(startedAt);
    }

    const phoneLimit = await checkLookupPhoneRateLimit(phoneDigits);
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "محاولات كثيرة لهذا الرقم. حاول لاحقاً.",
        },
        { status: 429 }
      );
    }

    const orderNumber = normalizeOrderNumber(parsed.data.orderNumber);
    if (!orderNumber) {
      return failResponse(startedAt);
    }

    const admin = createServiceClient();
    const { data: rows, error } = await admin
      .from("orders")
      .select(
        "id, order_number, customer_phone, tracking_token, status, delivered_at, cancelled_at, deleted_at, created_at"
      )
      .eq("order_number", orderNumber)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      logger.error("order_lookup.query_failed", { code: error.code ?? "unknown" });
      return failResponse(startedAt);
    }

    const matched = (rows ?? []).filter((row) =>
      phonesMatch(row.customer_phone, parsed.data.phone)
    );
    const order = pickLatestOrder(matched);

    if (!order?.tracking_token) {
      return failResponse(startedAt);
    }

    if (
      isTrackingExpired({
        status: order.status,
        deliveredAt: order.delivered_at,
        cancelledAt: order.cancelled_at,
      })
    ) {
      return failResponse(startedAt);
    }

    return NextResponse.json({
      trackingToken: order.tracking_token,
    });
  } catch (err) {
    logger.error("order_lookup.unhandled", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return failResponse(startedAt);
  }
}
