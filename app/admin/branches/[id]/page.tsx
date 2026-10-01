import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import type { Branch, Category } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أصناف الفرع | لوحة التحكم",
};

export default async function AdminBranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: branch }, { data: categories }, { data: allBranches }] =
    await Promise.all([
      supabase.from("branches").select("*").eq("id", id).single(),
      supabase
        .from("categories")
        .select("*")
        .eq("branch_id", id)
        .order("sort_order", { ascending: true }),
      supabase.from("branches").select("*").order("sort_order", { ascending: true }),
    ]);

  if (!branch) notFound();

  return (
    <CategoriesManager
      branch={branch as Branch}
      categories={(categories ?? []) as Category[]}
      allBranches={(allBranches ?? []) as Branch[]}
    />
  );
}
