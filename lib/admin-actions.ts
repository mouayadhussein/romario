"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/supabase/server";
import { slugify, uniquifySlug } from "@/lib/utils";
import {
  branchSchema,
  categorySchema,
  itemSchema,
} from "@/lib/validations";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { isAllowedImageUrl, isAllowedMapUrl } from "@/lib/security";
import { requireAdmin as requireAdminAuth } from "@/lib/auth-guards";
import {
  FEATURED_SETTINGS_KEY,
  MAX_FEATURED_COUNT,
  normalizeFeaturedSettings,
} from "@/lib/featured-items";
import {
  HERO_SETTINGS_KEY,
  normalizeHeroSettings,
} from "@/lib/hero-image";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ActionResult = { error?: string; success?: boolean; needsMfa?: boolean };

type AppSupabase = SupabaseClient<Database>;

async function requireAdmin(): Promise<AppSupabase> {
  const { supabase } = await requireAdminAuth();
  return supabase;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const unifiedError = "بيانات الدخول غير صحيحة";

  if (!email || !password || password.length > 200 || email.length > 200) {
    return { error: unifiedError };
  }

  const ip = await clientIp();
  const ipLimit = await checkLoginRateLimit(ip);
  const emailLimit = await checkLoginRateLimit(`email:${email}`);
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
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { error: unifiedError };
  }

  // MFA: if user has verified TOTP factors and session is AAL1, require second step
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    return { success: true, needsMfa: true };
  }

  return { success: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function verifyMfaAction(code: string): Promise<ActionResult> {
  const supabase = await requireAdminSoft();
  if (!supabase) return { error: "غير مصرح" };

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { error: "رمز التحقق غير صالح" };
  }

  const { data: factors, error: listError } =
    await supabase.auth.mfa.listFactors();
  if (listError) return { error: "تعذّر التحقق" };

  const totp = factors.totp.find((f) => f.status === "verified");
  if (!totp) return { error: "المصادقة الثنائية غير مفعّلة" };

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challengeError || !challenge) return { error: "تعذّر التحقق" };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code: trimmed,
  });

  if (verifyError) return { error: "رمز التحقق غير صحيح" };
  return { success: true };
}

/** Like requireAdmin but returns null instead of throwing (for MFA mid-login). */
async function requireAdminSoft(): Promise<AppSupabase | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return supabase;
}

export async function enrollMfaAction(): Promise<
  ActionResult & { qrCode?: string; secret?: string; factorId?: string }
> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Debbo Admin",
  });
  if (error || !data) {
    return { error: "تعذّر بدء إعداد المصادقة الثنائية" };
  }
  return {
    success: true,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    factorId: data.id,
  };
}

export async function confirmMfaEnrollAction(
  factorId: string,
  code: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (!factorId || !/^\d{6}$/.test(code.trim())) {
    return { error: "بيانات غير صالحة" };
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return { error: "تعذّر تأكيد الإعداد" };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) return { error: "رمز التحقق غير صحيح" };
  return { success: true };
}

export async function unenrollMfaAction(factorId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: "تعذّر إلغاء المصادقة الثنائية" };
  return { success: true };
}

export async function listMfaFactorsAction(): Promise<{
  error?: string;
  factors?: { id: string; friendly_name?: string; status: string }[];
}> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: "تعذّر جلب عوامل التحقق" };
  return {
    factors: data.totp.map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name,
      status: f.status,
    })),
  };
}

export async function upsertBranch(
  data: unknown,
  id?: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = branchSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (!isAllowedMapUrl(parsed.data.map_url)) {
    return { error: "رابط الخريطة غير مسموح" };
  }

  const { data: slugRows } = await supabase.from("branches").select("id, slug");
  const existingSlugs = (slugRows ?? []).map((r) => r.slug as string);
  const currentSlug = id
    ? ((slugRows ?? []).find((r) => r.id === id)?.slug as string | undefined)
    : undefined;

  const baseSlug = parsed.data.slug?.trim()
    ? parsed.data.slug.trim()
    : slugify(parsed.data.name);
  const uniqueSlug = uniquifySlug(baseSlug, existingSlugs, currentSlug);

  const payload = {
    ...parsed.data,
    slug: uniqueSlug,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    map_url:
      parsed.data.latitude != null && parsed.data.longitude != null
        ? `https://www.google.com/maps?q=${parsed.data.latitude},${parsed.data.longitude}`
        : parsed.data.map_url || null,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    whatsapp_number: parsed.data.whatsapp_number || null,
    working_hours: parsed.data.working_hours || null,
    opening_hours: parsed.data.opening_hours,
    timezone: parsed.data.timezone,
    ordering_mode: parsed.data.ordering_mode,
    delivery_fee: parsed.data.delivery_fee ?? 0,
    min_order_amount: parsed.data.min_order_amount ?? 0,
    free_delivery_threshold: parsed.data.free_delivery_threshold ?? null,
  };

  if (id) {
    const { error } = await supabase.from("branches").update(payload).eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: "المعرّف (Slug) مستخدم لفرع آخر" };
      return { error: "فشل حفظ الفرع" };
    }
  } else {
    const { error } = await supabase.from("branches").insert({
      ...payload,
      is_active: true,
    });
    if (error) {
      if (error.code === "23505") return { error: "المعرّف (Slug) مستخدم لفرع آخر" };
      return { error: "فشل حفظ الفرع" };
    }
  }

  revalidatePath("/admin/branches");
  revalidatePath("/");
  return { success: true };
}

export async function deleteBranch(id: string): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const BRANCH_HAS_ORDERS_MSG =
    "لا يمكن حذف فرع عليه طلبات سابقة. يمكنك تعطيله بدلاً من ذلك.";

  const { count, error: countError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", id);

  if (countError) return { error: "فشل التحقق من الطلبات" };
  if ((count ?? 0) > 0) {
    return { error: BRANCH_HAS_ORDERS_MSG };
  }

  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: BRANCH_HAS_ORDERS_MSG };
    }
    return { error: "فشل حذف الفرع" };
  }

  revalidatePath("/admin/branches");
  revalidatePath("/");
  return { success: true };
}

export async function upsertCategory(
  data: unknown,
  id?: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (!isAllowedImageUrl(parsed.data.image_url)) {
    return { error: "رابط الصورة غير مسموح" };
  }

  const payload = {
    ...parsed.data,
    image_url: parsed.data.image_url || null,
  };

  if (id) {
    const { error } = await supabase.from("categories").update(payload).eq("id", id);
    if (error) return { error: "فشل حفظ الصنف" };
  } else {
    const { error } = await supabase.from("categories").insert({
      ...payload,
      is_active: true,
    });
    if (error) return { error: "فشل حفظ الصنف" };
  }

  revalidatePath(`/admin/branches/${parsed.data.branch_id}`);
  return { success: true };
}

export async function deleteCategory(
  id: string,
  branchId: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: "فشل حذف الصنف" };
  revalidatePath(`/admin/branches/${branchId}`);
  return { success: true };
}

export async function upsertItem(
  data: unknown,
  id?: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (!isAllowedImageUrl(parsed.data.image_url)) {
    return { error: "رابط الصورة غير مسموح" };
  }

  const payload = {
    ...parsed.data,
    image_url: parsed.data.image_url || null,
    description: parsed.data.description || null,
  };

  if (id) {
    const { error } = await supabase.from("items").update(payload).eq("id", id);
    if (error) return { error: "فشل حفظ الوجبة" };
  } else {
    const { error } = await supabase.from("items").insert({
      ...payload,
      is_available: true,
    });
    if (error) return { error: "فشل حفظ الوجبة" };
  }

  revalidatePath(`/admin/categories/${parsed.data.category_id}`);
  return { success: true };
}

export async function deleteItem(
  id: string,
  categoryId: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { error: "فشل حذف الوجبة" };
  revalidatePath(`/admin/categories/${categoryId}`);
  return { success: true };
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<ActionResult> {
  const { updateOrderStatus: run } = await import("@/lib/order-actions");
  return run(orderId, status);
}

export async function duplicateCategory(
  categoryId: string,
  targetBranchId: string,
  itemIds?: string[]
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("id, name, image_url, is_active, sort_order, branch_id")
    .eq("id", categoryId)
    .single();

  if (catError || !category) return { error: "الصنف غير موجود" };

  const { data: newCat, error: insertCatError } = await supabase
    .from("categories")
    .insert({
      branch_id: targetBranchId,
      name: category.name,
      image_url: category.image_url,
      is_active: category.is_active,
      sort_order: category.sort_order,
    })
    .select("id")
    .single();

  if (insertCatError || !newCat) return { error: "فشل النسخ" };

  let itemsQuery = supabase
    .from("items")
    .select(
      "id, name, description, price, image_url, is_available, sort_order, category_id"
    )
    .eq("category_id", categoryId);

  if (itemIds !== undefined) {
    if (itemIds.length === 0) {
      revalidatePath(`/admin/branches/${targetBranchId}`);
      return { success: true };
    }
    itemsQuery = itemsQuery.in("id", itemIds);
  }

  const { data: items } = await itemsQuery;

  if (items && items.length > 0) {
    const rows = items.map((item) => ({
      category_id: newCat.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      is_available: item.is_available,
      sort_order: item.sort_order,
    }));

    const { error: itemsError } = await supabase.from("items").insert(rows);
    if (itemsError) return { error: "فشل نسخ الوجبات" };
  }

  revalidatePath(`/admin/branches/${targetBranchId}`);
  return { success: true };
}

export type BranchCategoryWithItems = {
  id: string;
  name: string;
  items: { id: string; name: string; price: number }[];
};

export async function listBranchCategories(branchId: string): Promise<{
  error?: string;
  categories?: BranchCategoryWithItems[];
}> {
  const supabase = await requireAdmin();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: true });

  if (error) return { error: "فشل جلب الأصناف" };
  if (!categories || categories.length === 0) {
    return { categories: [] };
  }

  const ids = categories.map((c) => c.id);
  const { data: items } = await supabase
    .from("items")
    .select("id, name, price, category_id")
    .in("category_id", ids)
    .order("sort_order", { ascending: true });

  const byCategory = new Map<string, { id: string; name: string; price: number }[]>();
  for (const row of items ?? []) {
    const key = row.category_id as string;
    const list = byCategory.get(key) ?? [];
    list.push({
      id: row.id as string,
      name: row.name as string,
      price: Number(row.price),
    });
    byCategory.set(key, list);
  }

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: byCategory.get(c.id) ?? [],
    })),
  };
}

export type DuplicateMenuSelection = {
  categoryId: string;
  itemIds: string[];
};

export async function duplicateMenu(
  sourceBranchId: string,
  targetBranchId: string,
  selections?: DuplicateMenuSelection[]
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  if (sourceBranchId === targetBranchId) {
    return { error: "اختر فرعين مختلفين" };
  }

  let toCopy = selections;

  if (toCopy === undefined) {
    const listed = await listBranchCategories(sourceBranchId);
    if (listed.error) return { error: listed.error };
    toCopy = (listed.categories ?? []).map((c) => ({
      categoryId: c.id,
      itemIds: c.items.map((i) => i.id),
    }));
  }

  const filtered = toCopy.filter((s) => s.itemIds.length > 0);
  if (filtered.length === 0) {
    return { error: "اختر وجبة واحدةً على الأقل للنسخ" };
  }

  const categoryIds = filtered.map((s) => s.categoryId);
  const { data: owned } = await supabase
    .from("categories")
    .select("id")
    .eq("branch_id", sourceBranchId)
    .in("id", categoryIds);

  const ownedIds = new Set((owned ?? []).map((c) => c.id));

  for (const selection of filtered) {
    if (!ownedIds.has(selection.categoryId)) continue;
    const result = await duplicateCategory(
      selection.categoryId,
      targetBranchId,
      selection.itemIds
    );
    if (result.error) return result;
  }

  revalidatePath(`/admin/branches/${targetBranchId}`);
  return { success: true };
}

export async function reorderEntity(
  table: "branches" | "categories" | "items",
  orderedIds: string[]
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  if (!Array.isArray(orderedIds) || orderedIds.length > 500) {
    return { error: "بيانات غير صالحة" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { error: "فشل تحديث الترتيب" };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function saveFeaturedMealsAction(input: {
  display_count: number;
  item_ids: string[];
}): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const parsed = normalizeFeaturedSettings({
    display_count: input.display_count,
    item_ids: input.item_ids,
  });

  if (parsed.display_count > MAX_FEATURED_COUNT) {
    return { error: "عدد الصور أكبر من المسموح" };
  }

  if (parsed.item_ids.length > 100) {
    return { error: "عدد الوجبات المحددة كبير جداً" };
  }

  if (parsed.item_ids.length > 0) {
    const uniqueIds = [...new Set(parsed.item_ids)];
    const { data: existing, error: itemsError } = await supabase
      .from("items")
      .select("id")
      .in("id", uniqueIds);

    if (itemsError) return { error: "تعذّر التحقق من الوجبات" };
    const ok = new Set((existing ?? []).map((r) => r.id));
    if (uniqueIds.some((id) => !ok.has(id))) {
      return { error: "بعض الوجبات المحددة غير موجودة" };
    }
    parsed.item_ids = uniqueIds.filter((id) => ok.has(id));
  }

  const value: Database["public"]["Tables"]["site_settings"]["Row"]["value"] = {
    display_count: parsed.display_count,
    item_ids: parsed.item_ids,
  };

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: FEATURED_SETTINGS_KEY,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return { error: "فشل حفظ الإعدادات" };

  revalidatePath("/");
  revalidatePath("/admin/featured");
  return { success: true };
}

export async function saveHeroImageAction(input: {
  image_url: string | null;
}): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const parsed = normalizeHeroSettings({ image_url: input.image_url });

  if (parsed.image_url && !isAllowedImageUrl(parsed.image_url)) {
    return { error: "رابط الصورة غير مسموح" };
  }

  const value: Database["public"]["Tables"]["site_settings"]["Row"]["value"] = {
    image_url: parsed.image_url,
  };

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: HERO_SETTINGS_KEY,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return { error: "فشل حفظ صورة الصفحة الرئيسية" };

  revalidatePath("/");
  revalidatePath("/admin/featured");
  return { success: true };
}
