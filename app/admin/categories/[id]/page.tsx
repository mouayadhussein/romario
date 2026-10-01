import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { ItemsManager } from "@/components/admin/ItemsManager";
import type { Branch, Category, Item } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "وجبات الصنف | لوحة التحكم",
};

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (!category) notFound();
  const typedCategory = category as Category;

  const [{ data: items }, { data: branch }] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .eq("category_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("branches")
      .select("id, name")
      .eq("id", typedCategory.branch_id)
      .single(),
  ]);

  if (!branch) notFound();

  return (
    <ItemsManager
      category={typedCategory}
      branch={branch as Pick<Branch, "id" | "name">}
      items={(items ?? []) as Item[]}
    />
  );
}
