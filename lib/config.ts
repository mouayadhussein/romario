export const config = {
  currency: "ILS",
  currencySymbol: "₪",
  appName: "قائمة المطعم",
  appNameEn: "Restaurant Menu",
  defaultLocale: "ar" as const,
  locales: ["ar", "en"] as const,
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 10,
  },
  imageMaxSizeMB: 1,
  imageMaxWidthOrHeight: 1200,
} as const;

export type Locale = (typeof config.locales)[number];
