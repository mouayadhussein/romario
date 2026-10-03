import { createClient } from "@/supabase/server";
import {
  FeaturedMealsManager,
  type AdminMealOption,
} from "@/components/admin/FeaturedMealsManager";
import { getFeaturedSettings } from "@/lib/featured-items";
import type { Branch, Category, Item } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedPage() {
  const supabase = await createClient();
  const settings = await getFeaturedSettings(supabase);

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const branches = (branchesData ?? []) as Pick<
    Branch,
    "id" | "name" | "slug" | "is_active"
  >[];
  const branchById = new Map(branches.map((b) => [b.id, b]));
  const branchIds = branches.map((b) => b.id);

  let meals: AdminMealOption[] = [];

  if (branchIds.length > 0) {
    const { data: catsData } = await supabase
      .from("categories")
      .select("id, branch_id, name, is_active")
      .in("branch_id", branchIds)
      .eq("is_active", true);

    const cats = (catsData ?? []) as Pick<
      Category,
      "id" | "branch_id" | "name" | "is_active"
    >[];
    const catById = new Map(cats.map((c) => [c.id, c]));
    const categoryIds = cats.map((c) => c.id);

    if (categoryIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("items")
        .select(
          "id, category_id, name, description, price, image_url, is_available, sort_order"
        )
        .in("category_id", categoryIds)
        .order("name", { ascending: true });

      const items = (itemsData ?? []) as Item[];
      meals = items.flatMap((item) => {
        const cat = catById.get(item.category_id);
        if (!cat) return [];
        const branch = branchById.get(cat.branch_id);
        if (!branch) return [];
        return [
          {
            id: item.id,
            name: item.name,
            price: Number(item.price),
            imageUrl: item.image_url,
            categoryName: cat.name,
            branchName: branch.name,
            branchSlug: branch.slug,
          },
        ];
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <FeaturedMealsManager initialSettings={settings} meals={meals} />
    </div>
  );
}
