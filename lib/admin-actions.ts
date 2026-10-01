"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { slugify, uniquifySlug } from "@/lib/utils";
import { branchSchema, categorySchema, itemSchema, orderStatusSchema } from "@/lib/validations";

type ActionResult = { error?: string; success?: boolean };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح");
  return supabase;
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "بيانات الدخول غير صحيحة" };
  return { success: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function upsertBranch(data: unknown, id?: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = branchSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
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
    map_url: parsed.data.map_url || null,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    whatsapp_number: parsed.data.whatsapp_number || null,
    working_hours: parsed.data.working_hours || null,
    opening_hours: parsed.data.opening_hours,
    timezone: parsed.data.timezone,
    ordering_mode: parsed.data.ordering_mode,
  };

  if (id) {
    const { error } = await supabase.from("branches").update(payload).eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: "المعرّف (Slug) مستخدم لفرع آخر" };
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("branches").insert(payload);
    if (error) {
      if (error.code === "23505") return { error: "المعرّف (Slug) مستخدم لفرع آخر" };
      return { error: error.message };
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

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return { error: BRANCH_HAS_ORDERS_MSG };
  }

  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: BRANCH_HAS_ORDERS_MSG };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/branches");
  revalidatePath("/");
  return { success: true };
}

export async function upsertCategory(data: unknown, id?: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const payload = {
    ...parsed.data,
    image_url: parsed.data.image_url || null,
  };

  if (id) {
    const { error } = await supabase.from("categories").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("categories").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/branches/${parsed.data.branch_id}`);
  return { success: true };
}

export async function deleteCategory(id: string, branchId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/branches/${branchId}`);
  return { success: true };
}

export async function upsertItem(data: unknown, id?: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const payload = {
    ...parsed.data,
    image_url: parsed.data.image_url || null,
    description: parsed.data.description || null,
  };

  if (id) {
    const { error } = await supabase.from("items").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("items").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/categories/${parsed.data.category_id}`);
  return { success: true };
}

export async function deleteItem(id: string, categoryId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/categories/${categoryId}`);
  return { success: true };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "حالة غير صالحة" };

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data })
    .eq("id", orderId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function duplicateCategory(
  categoryId: string,
  targetBranchId: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("*")
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

  if (insertCatError || !newCat) return { error: insertCatError?.message ?? "فشل النسخ" };

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("category_id", categoryId);

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
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath(`/admin/branches/${targetBranchId}`);
  return { success: true };
}

export async function duplicateMenu(
  sourceBranchId: string,
  targetBranchId: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  if (sourceBranchId === targetBranchId) {
    return { error: "اختر فرعين مختلفين" };
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("branch_id", sourceBranchId);

  if (!categories || categories.length === 0) {
    return { error: "لا توجد أصناف في الفرع المصدر" };
  }

  for (const cat of categories) {
    const result = await duplicateCategory(cat.id, targetBranchId);
    if ("error" in result) return result;
  }

  revalidatePath(`/admin/branches/${targetBranchId}`);
  return { success: true };
}

export async function reorderEntity(
  table: "branches" | "categories" | "items",
  orderedIds: string[]
): Promise<ActionResult> {
  const supabase = await requireAdmin();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}
