import { createClient } from "@/supabase/server";
import { HomeHero } from "@/components/site/HomeHero";
import { HomeHeader } from "@/components/site/HomeHeader";
import { HomeCategories } from "@/components/site/HomeCategories";
import { HomeFeatured } from "@/components/site/HomeFeatured";
import { HomeLocations } from "@/components/site/HomeLocations";
import { HomeOrderTrack } from "@/components/site/HomeOrderTrack";
import { HomeFooter } from "@/components/site/HomeFooter";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBranchStatus } from "@/lib/opening-hours";
import {
  getFeaturedSettings,
  resolveFeaturedMeals,
  type FeaturedMeal,
} from "@/lib/featured-items";
import { getDictionary } from "@/lib/i18n";
import type { Branch, Category, Item } from "@/types/database";
import type { Metadata } from "next";
import type {
  HomeSearchCategory,
  HomeSearchItem,
} from "@/components/site/HomeHeader";

const t = getDictionary("ar").site;

export const metadata: Metadata = {
  title: t.branchesTitle,
  description: t.branchesSubtitle,
};

export const dynamic = "force-dynamic";

function uniqueCategories(
  categories: Category[],
  branchById: Map<string, Branch>
): HomeSearchCategory[] {
  const map = new Map<string, HomeSearchCategory>();

  for (const cat of categories) {
    const key = cat.name.trim().toLowerCase();
    if (!key) continue;
    const branch = branchById.get(cat.branch_id);
    if (!branch) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: cat.name.trim(),
        imageUrl: cat.image_url,
        branches: [
          { id: branch.id, name: branch.name, slug: branch.slug },
        ],
      });
      continue;
    }

    if (!existing.branches.some((b) => b.id === branch.id)) {
      existing.branches.push({
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
      });
    }
    if (!existing.imageUrl && cat.image_url) {
      existing.imageUrl = cat.image_url;
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select(
      "id, name, slug, address, phone, whatsapp_number, map_url, latitude, longitude, working_hours, opening_hours, timezone, ordering_mode, is_active, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const branches = (data ?? []) as Branch[];
  const branchIds = branches.map((b) => b.id);
  const branchById = new Map(branches.map((b) => [b.id, b]));

  let categories: Category[] = [];
  let searchItems: HomeSearchItem[] = [];
  let featuredMeals: FeaturedMeal[] = [];

  if (branchIds.length > 0) {
    const { data: catsData } = await supabase
      .from("categories")
      .select("id, branch_id, name, image_url, is_active, sort_order")
      .in("branch_id", branchIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    categories = (catsData ?? []) as Category[];
    const categoryIds = categories.map((c) => c.id);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    if (categoryIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("items")
        .select(
          "id, category_id, name, description, price, image_url, is_available, sort_order"
        )
        .in("category_id", categoryIds)
        .eq("is_available", true)
        .order("sort_order", { ascending: true });

      const items = (itemsData ?? []) as Item[];
      searchItems = items.flatMap((item) => {
        const cat = categoryById.get(item.category_id);
        if (!cat) return [];
        const branch = branchById.get(cat.branch_id);
        if (!branch) return [];
        return [
          {
            id: item.id,
            name: item.name,
            description: item.description,
            price: Number(item.price),
            imageUrl: item.image_url,
            categoryName: cat.name,
            branchId: branch.id,
            branchName: branch.name,
            branchSlug: branch.slug,
          },
        ];
      });

      const settings = await getFeaturedSettings(supabase);
      const candidates: FeaturedMeal[] = searchItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        branchSlug: item.branchSlug,
        branchName: item.branchName,
      }));
      featuredMeals = resolveFeaturedMeals(candidates, settings);
    }
  }

  const uniqueCats = uniqueCategories(categories, branchById);
  const anyOpen = branches.some((b) => getBranchStatus(b).isOpen);

  return (
    <div className="min-h-screen bg-[#f7f6f4]">
      <HomeHeader
        anyOpen={anyOpen}
        categories={uniqueCats}
        items={searchItems}
        activeSection="home"
      />

      <HomeHero />

      <HomeFeatured meals={featuredMeals} />

      <HomeCategories categories={uniqueCats} />

      {error ? (
        <div className="px-4 py-10">
          <EmptyState title="تعذّر تحميل الفروع" description="حاول مرة أخرى لاحقاً" />
        </div>
      ) : branches.length === 0 ? (
        <div className="px-4 py-10">
          <EmptyState title={t.noBranches} />
        </div>
      ) : (
        <HomeLocations branches={branches} />
      )}

      <HomeOrderTrack />

      <HomeFooter branches={branches} />
    </div>
  );
}
