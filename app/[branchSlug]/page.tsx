import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BranchMenu } from "@/components/site/BranchMenu";
import type { Branch, Category, Item, CategoryWithItems } from "@/types/database";

export const dynamic = "force-dynamic";

async function getBranchMenu(slug: string) {
  const supabase = await createClient();

  const { data: branch } = await supabase
    .from("branches")
    .select(
      "id, name, slug, address, phone, whatsapp_number, map_url, latitude, longitude, working_hours, opening_hours, timezone, ordering_mode, is_active, sort_order"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!branch) return null;

  const typedBranch = branch as Branch;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, branch_id, name, image_url, is_active, sort_order")
    .eq("branch_id", typedBranch.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const cats = (categories ?? []) as Category[];
  const categoryIds = cats.map((c) => c.id);

  let items: Item[] = [];
  if (categoryIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("items")
      .select(
        "id, category_id, name, description, price, image_url, is_available, sort_order"
      )
      .in("category_id", categoryIds)
      .order("sort_order", { ascending: true });
    items = (itemsData ?? []) as Item[];
  }

  const categoriesWithItems: CategoryWithItems[] = cats.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category_id === cat.id),
  }));

  return { branch: typedBranch, categories: categoriesWithItems };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}): Promise<Metadata> {
  const { branchSlug } = await params;
  const data = await getBranchMenu(branchSlug);
  if (!data) return { title: "فرع غير موجود" };
  return {
    title: data.branch.name,
    description: data.branch.address ?? `قائمة ${data.branch.name}`,
  };
}

export default async function BranchPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = await params;
  const data = await getBranchMenu(branchSlug);
  if (!data) notFound();

  return (
    <CartProvider branchSlug={branchSlug}>
      <SiteHeader branchName={data.branch.name} branchSlug={branchSlug} showCart />
      <main className="mx-auto max-w-3xl px-4 py-4 pb-20">
        <BranchMenu branch={data.branch} categories={data.categories} />
      </main>
    </CartProvider>
  );
}
