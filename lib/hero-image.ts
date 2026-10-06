import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const HERO_SETTINGS_KEY = "homepage_hero";

/** Built-in fallback when admin has not set a custom hero image. */
export const DEFAULT_HERO_IMAGE = "/images/hero-banner.png";

export type HeroSettings = {
  image_url: string | null;
};

type AppSupabase = SupabaseClient<Database>;

export function normalizeHeroSettings(raw: unknown): HeroSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const url = typeof obj.image_url === "string" ? obj.image_url.trim() : "";
  return { image_url: url || null };
}

export async function getHeroSettings(
  supabase: AppSupabase
): Promise<HeroSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HERO_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data?.value) return { image_url: null };
  return normalizeHeroSettings(data.value);
}

/** Public URL for the homepage hero (custom or default asset). */
export function resolveHeroImageUrl(settings: HeroSettings): string {
  return settings.image_url || DEFAULT_HERO_IMAGE;
}
