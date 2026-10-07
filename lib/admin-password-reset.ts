"use server";

import { headers } from "next/headers";
import { createClient } from "@/supabase/server";
import { createServiceClient } from "@/supabase/admin";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";

type ActionResult = { error?: string; success?: boolean; message?: string };

const GENERIC_SENT =
  "إذا كان البريد مسجّلاً لحساب مدير، ستصلك رسالة خلال دقائق لتعيين كلمة مرور جديدة.";

function siteOrigin(): string {
  const url = getEnv().NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

async function adminUserIdForEmail(email: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: rows, error } = await service.from("admins").select("user_id");
  if (error || !rows?.length) return null;

  for (const row of rows) {
    const { data, error: userErr } = await service.auth.admin.getUserById(
      row.user_id
    );
    if (userErr || !data.user) continue;
    if (data.user.email?.trim().toLowerCase() === email) return row.user_id;
  }
  return null;
}

export async function requestAdminPasswordResetAction(
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "أدخل بريداً إلكترونياً صالحاً" };
  }

  const ip = await clientIp();
  const ipLimit = await checkLoginRateLimit(`reset:ip:${ip}`);
  const emailLimit = await checkLoginRateLimit(`reset:email:${email}`);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "محاولات كثيرة، حاول لاحقاً" };
  }

  const adminId = await adminUserIdForEmail(email);
  if (adminId) {
    const supabase = await createClient();
    const redirectTo = `${siteOrigin()}/auth/callback?next=${encodeURIComponent("/admin/reset-password")}`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }

  return { success: true, message: GENERIC_SENT };
}

export async function resetAdminPasswordAction(
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8 || password.length > 200) {
    return { error: "كلمة المرور يجب أن تكون من 8 إلى 200 حرف" };
  }
  if (password !== confirm) {
    return { error: "كلمتا المرور غير متطابقتين" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "انتهت صلاحية الرابط. اطلب إعادة تعيين جديدة." };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { error: "غير مصرح" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "تعذّر تحديث كلمة المرور. جرّب مرة أخرى أو اطلب رابطاً جديداً." };
  }

  await supabase.auth.signOut();
  return { success: true };
}
