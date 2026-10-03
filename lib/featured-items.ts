import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const FEATURED_SETTINGS_KEY = "homepage_featured";
export const DEFAULT_FEATURED_COUNT = 4;
export const MAX_FEATURED_COUNT = 12;

export type FeaturedSettings = {
  display_count: number;
  item_ids: string[];
};

export type FeaturedMeal = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  branchSlug: string;
  branchName: string;
};

type AppSupabase = SupabaseClient<Database>;

export function normalizeFeaturedSettings(raw: unknown): FeaturedSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const countRaw = Number(obj.display_count);
  const display_count = Number.isFinite(countRaw)
    ? Math.min(MAX_FEATURED_COUNT, Math.max(0, Math.round(countRaw)))
    : DEFAULT_FEATURED_COUNT;

  const item_ids = Array.isArray(obj.item_ids)
    ? obj.item_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  return { display_count, item_ids };
}

/** Stable pseudo-random shuffle (same seed → same order). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function getFeaturedSettings(
  supabase: AppSupabase
): Promise<FeaturedSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", FEATURED_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data?.value) {
    return { display_count: DEFAULT_FEATURED_COUNT, item_ids: [] };
  }
  return normalizeFeaturedSettings(data.value);
}

export function resolveFeaturedMeals(
  candidates: FeaturedMeal[],
  cfg: FeaturedSettings
): FeaturedMeal[] {
  if (cfg.display_count <= 0 || candidates.length === 0) return [];

  if (cfg.item_ids.length > 0) {
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const picked = cfg.item_ids
      .map((id) => byId.get(id))
      .filter((x): x is FeaturedMeal => !!x)
      .slice(0, cfg.display_count);
    if (picked.length > 0) return picked;
  }

  const withImages = candidates.filter((c) => !!c.imageUrl);
  const pool = withImages.length > 0 ? withImages : candidates;
  return seededShuffle(pool, "debbo-featured-default-v1").slice(
    0,
    Math.min(cfg.display_count || DEFAULT_FEATURED_COUNT, pool.length)
  );
}

export function pickDefaultItemIds(
  items: { id: string; imageUrl?: string | null }[],
  count = DEFAULT_FEATURED_COUNT
): string[] {
  const withImages = items.filter((i) => i.imageUrl);
  const pool = withImages.length > 0 ? withImages : items;
  return seededShuffle(pool, "debbo-featured-default-v1")
    .slice(0, Math.min(count, pool.length))
    .map((i) => i.id);
}
