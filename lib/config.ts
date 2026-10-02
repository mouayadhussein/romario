export const config = {
  currency: "SYP",
  currencySymbol: "ليرة",
  appName: "ديبو",
  appNameEn: "Debbo",
  defaultLocale: "ar" as const,
  locales: ["ar", "en"] as const,
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 10,
  },
  imageMaxSizeMB: 2,
  imageMaxWidthOrHeight: 1200,
} as const;

export type Locale = (typeof config.locales)[number];
