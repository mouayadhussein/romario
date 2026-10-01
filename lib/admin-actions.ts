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
    // New branches are always published until an admin deactivates them
    const { error } = await supabase.from("branches").insert({
      ...payload,
      is_active: true,
    });
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
    // New categories are always active until an admin deactivates them
    const { error } = await supabase.from("categories").insert({
      ...payload,
      is_active: true,
    });
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
    // New meals are always available until an admin deactivates them
    const { error } = await supabase.from("items").insert({
      ...payload,
      is_available: true,
    });
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
  targetBranchId: string,
  itemIds?: string[]
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

  let itemsQuery = supabase
    .from("items")
    .select("*")
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
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath(`/admin/branches/${targetBranchId}`);
  return { success: true };
}

export type BranchCategoryWithItems = {
  id: string;
  name: string;
  items: { id: string; name: string; price: number }[];
};

export async function listBranchCategories(
  branchId: string
): Promise<{
  error?: string;
  categories?: BranchCategoryWithItems[];
}> {
  const supabase = await requireAdmin();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message };
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
