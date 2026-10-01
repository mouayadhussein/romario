import { ar, type Dictionary } from "./ar";
import type { Locale } from "@/lib/config";

const dictionaries: Record<Locale, Dictionary> = {
  ar,
  // English can be added later — falls back to Arabic structure
  en: ar,
};

export function getDictionary(locale: Locale = "ar"): Dictionary {
  return dictionaries[locale] ?? ar;
}

export type { Dictionary };
