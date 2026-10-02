import "server-only";

import { createClient } from "@/supabase/server";
import { createServiceClient } from "@/supabase/admin";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ActorRole } from "@/types/database";

export type AppSupabase = SupabaseClient<Database>;

export async function requireAdmin(): Promise<{
  supabase: AppSupabase;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) {
    logger.warn("admin.authz_denied", { userIdPrefix: user.id.slice(0, 8) });
    throw new Error("غير مصرح");
  }
  return { supabase, userId: user.id };
}

export async function requireStaff(): Promise<{
  supabase: AppSupabase;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح");

  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) {
    logger.warn("staff.authz_denied", { userIdPrefix: user.id.slice(0, 8) });
    throw new Error("غير مصرح");
  }

  const { data: row } = await supabase
    .from("staff")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row?.is_active) {
    await supabase.auth.signOut();
    throw new Error("الحساب معطّل");
  }

  return { supabase, userId: user.id };
}

export async function insertOrderEvent(params: {
  orderId: string;
  actorId: string | null;
  actorRole: ActorRole;
  event: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  meta?: Record<string, unknown>;
}) {
  const admin = createServiceClient();
  const { error } = await admin.from("order_events").insert({
    order_id: params.orderId,
    actor_id: params.actorId,
    actor_role: params.actorRole,
    event: params.event,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    meta: (params.meta ?? {}) as Database["public"]["Tables"]["order_events"]["Insert"]["meta"],
  });
  if (error) {
    logger.error("order_events.insert_failed", { code: error.code ?? "unknown" });
  }
}

export function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
