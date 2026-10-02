"use server";

import { headers } from "next/headers";
import { createClient } from "@/supabase/server";
import { checkLoginRateLimit } from "@/lib/rate-limit";

type ActionResult = { error?: string; success?: boolean };

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function staffLoginAction(
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const unifiedError = "بيانات الدخول غير صحيحة";

  if (!email || !password || password.length > 200 || email.length > 200) {
    return { error: unifiedError };
  }

  const ip = await clientIp();
  const ipLimit = await checkLoginRateLimit(`staff:${ip}`);
  const emailLimit = await checkLoginRateLimit(`staff-email:${email}`);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "محاولات كثيرة، حاول لاحقاً" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: unifiedError };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) {
    await supabase.auth.signOut();
    return { error: "حساب الإدارة يستخدم صفحة دخول لوحة التحكم" };
  }

  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return { error: unifiedError };
  }

  const { data: row } = await supabase
    .from("staff")
    .select("is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!row?.is_active) {
    await supabase.auth.signOut();
    return { error: "الحساب معطّل. تواصل مع الإدارة." };
  }

  return { success: true };
}

export async function staffLogoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
