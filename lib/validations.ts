import { z } from "zod";
import {
  DAY_KEYS,
  isValidHHMM,
  periodsOverlap,
  type DayKey,
  type OpeningHours,
  type TimeRange,
} from "@/lib/opening-hours";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

const optionalUrl = z
  .string()
  .trim()
  .max(500, "الرابط طويل جداً")
  .optional()
  .nullable()
  .refine((v) => !v || v === "" || z.string().url().safeParse(v).success, {
    message: "رابط غير صالح",
  });

/** Reject HTML / angle brackets in user-facing text fields. */
/** Names/titles/descriptions: Arabic, English, digits — no HTML */
const nameField = (label = "الاسم") =>
  z
    .string({ error: `${label} مطلوب` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(100, `${label} طويل جداً`)
    .refine((v) => !/[<>]/.test(v), { message: "لا يُسمح بوسوم HTML" });

const descriptionField = z
  .string()
  .trim()
  .max(500, "الوصف طويل جداً")
  .refine((v) => !/[<>]/.test(v), { message: "لا يُسمح بوسوم HTML" })
  .optional()
  .nullable();

const plainText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .refine((v) => !/[<>]/.test(v), { message: "لا يُسمح بوسوم HTML" });
/** Slug: optional; when provided must be a-z, 0-9, hyphens only */
const slugField = z
  .string()
  .trim()
  .max(50, "المعرّف طويل جداً")
  .refine((v) => v === "" || /^[a-z0-9-]+$/.test(v), {
    message: "المعرّف يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط",
  })
  .optional()
  .transform((v) => (v && v.length > 0 ? v : ""));

const timeRangeSchema = z.object({
  open: z
    .string()
    .refine(isValidHHMM, { message: "وقت الفتح يجب أن يكون بصيغة HH:MM" }),
  close: z
    .string()
    .refine(isValidHHMM, { message: "وقت الإغلاق يجب أن يكون بصيغة HH:MM" }),
});

const openingHoursSchema = z
  .record(z.string(), z.array(timeRangeSchema))
  .superRefine((hours, ctx) => {
    for (const day of Object.keys(hours)) {
      if (!DAY_KEYS.includes(day as DayKey)) {
        ctx.addIssue({
          code: "custom",
          message: `يوم غير صالح: ${day}`,
          path: [day],
        });
        continue;
      }
      const periods = hours[day] as TimeRange[];
      for (const p of periods) {
        if (p.open === p.close) {
          ctx.addIssue({
            code: "custom",
            message: "وقت الفتح والإغلاق لا يمكن أن يكونا متساويين",
            path: [day],
          });
        }
      }
      if (periodsOverlap(periods)) {
        ctx.addIssue({
          code: "custom",
          message: "فترات العمل متداخلة في نفس اليوم",
          path: [day],
        });
      }
    }
  })
  .transform((hours) => {
    const cleaned: OpeningHours = {};
    for (const day of DAY_KEYS) {
      cleaned[day] = (hours[day] as TimeRange[] | undefined) ?? [];
    }
    return cleaned;
  });

export const orderItemSchema = z
  .object({
    itemId: z.string().uuid({ error: "معرّف الصنف غير صالح" }),
    quantity: z
      .number({ error: "الكمية غير صالحة" })
      .int("الكمية يجب أن تكون عدداً صحيحاً")
      .min(1, "الكمية يجب أن تكون 1 على الأقل")
      .max(20, "الكمية يجب ألا تتجاوز 20"),
    note: plainText(200, "الملاحظة طويلة جداً").optional().nullable(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    branchId: z.string().uuid({ error: "الفرع غير صالح" }),
    customerName: nameField("الاسم"),
    customerPhone: z
      .string({ error: "رقم الهاتف مطلوب" })
      .trim()
      .min(8, "رقم الهاتف قصير جداً")
      .max(20, "رقم الهاتف طويل جداً")
      .regex(/^[\d+\-\s]+$/, "رقم هاتف غير صالح"),
    customerAddress: plainText(300, "العنوان طويل جداً").optional().nullable(),
    customerLat: z
      .number({ error: "خط العرض غير صالح" })
      .min(-90, "خط العرض غير صالح")
      .max(90, "خط العرض غير صالح")
      .optional()
      .nullable(),
    customerLng: z
      .number({ error: "خط الطول غير صالح" })
      .min(-180, "خط الطول غير صالح")
      .max(180, "خط الطول غير صالح")
      .optional()
      .nullable(),
    orderType: z.enum(["delivery", "pickup", "dine_in"], {
      error: "نوع الطلب غير صالح",
    }),
    tableNumber: plainText(20, "رقم الطاولة طويل جداً").optional().nullable(),
    generalNote: plainText(500, "الملاحظة طويلة جداً").optional().nullable(),
    items: z
      .array(orderItemSchema)
      .min(1, "أضف وجبة واحدة على الأقل")
      .max(50, "عدد الوجبات كبير جداً"),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.orderType === "delivery" && !data.customerAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "عنوان التوصيل مطلوب",
        path: ["customerAddress"],
      });
    }
    if (data.orderType === "dine_in" && !data.tableNumber?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "رقم الطاولة مطلوب",
        path: ["tableNumber"],
      });
    }

    const hasLat = data.customerLat != null;
    const hasLng = data.customerLng != null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: "custom",
        message: "يجب إرسال خط العرض وخط الطول معاً أو تركهما فارغين",
        path: hasLat ? ["customerLng"] : ["customerLat"],
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const branchSchema = z.object({
  name: nameField("اسم الفرع"),
  slug: slugField,
  address: plainText(300, "العنوان طويل جداً").optional().nullable(),
  phone: z
    .string()
    .trim()
    .max(20, "رقم الهاتف طويل جداً")
    .optional()
    .nullable(),
  whatsapp_number: z
    .string()
    .trim()
    .max(25, "رقم واتساب طويل جداً")
    .optional()
    .nullable()
    .refine(
      (v) => !v || v === "" || normalizeWhatsappNumber(v) !== null,
      {
        message: "أدخل الرقم بالصيغة الدولية، مثال: 905348271939",
      }
    )
    .transform((v) => {
      if (!v || v === "") return null;
      return normalizeWhatsappNumber(v);
    }),
  map_url: optionalUrl,
  latitude: z
    .number({ error: "خط العرض غير صالح" })
    .min(-90, "خط العرض غير صالح")
    .max(90, "خط العرض غير صالح")
    .optional()
    .nullable(),
  longitude: z
    .number({ error: "خط الطول غير صالح" })
    .min(-180, "خط الطول غير صالح")
    .max(180, "خط الطول غير صالح")
    .optional()
    .nullable(),
  working_hours: z
    .string()
    .trim()
    .max(200, "ساعات العمل طويلة جداً")
    .optional()
    .nullable(),
  opening_hours: openingHoursSchema,
  timezone: z
    .string({ error: "المنطقة الزمنية مطلوبة" })
    .trim()
    .min(1, "المنطقة الزمنية مطلوبة")
    .max(64, "المنطقة الزمنية غير صالحة"),
  ordering_mode: z.enum(["auto", "force_open", "force_closed"], {
    error: "وضع الطلبات غير صالح",
  }),
  is_active: z.boolean({ error: "حالة النشاط غير صالحة" }),
  sort_order: z
    .number({ error: "الترتيب غير صالح" })
    .int("الترتيب يجب أن يكون عدداً صحيحاً")
    .min(0, "الترتيب لا يمكن أن يكون سالباً"),
}).superRefine((data, ctx) => {
  const hasLat = data.latitude != null;
  const hasLng = data.longitude != null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: "custom",
      message: "يجب إرسال خط العرض وخط الطول معاً أو تركهما فارغين",
      path: hasLat ? ["longitude"] : ["latitude"],
    });
  }
});

export type BranchInput = z.infer<typeof branchSchema>;

export const categorySchema = z.object({
  branch_id: z.string().uuid({ error: "الفرع غير صالح" }),
  name: nameField("اسم الصنف"),
  image_url: optionalUrl,
  is_active: z.boolean({ error: "حالة النشاط غير صالحة" }),
  sort_order: z
    .number({ error: "الترتيب غير صالح" })
    .int("الترتيب يجب أن يكون عدداً صحيحاً")
    .min(0, "الترتيب لا يمكن أن يكون سالباً"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const itemSchema = z.object({
  category_id: z.string().uuid({ error: "الصنف غير صالح" }),
  name: nameField("اسم الوجبة"),
  description: descriptionField,
  price: z
    .number({ error: "السعر غير صالح" })
    .min(0, "السعر لا يمكن أن يكون سالباً")
    .max(99999, "السعر كبير جداً"),
  image_url: optionalUrl,
  is_available: z.boolean({ error: "حالة التوفر غير صالحة" }),
  sort_order: z
    .number({ error: "الترتيب غير صالح" })
    .int("الترتيب يجب أن يكون عدداً صحيحاً")
    .min(0, "الترتيب لا يمكن أن يكون سالباً"),
});

export type ItemInput = z.infer<typeof itemSchema>;

export const orderStatusSchema = z.enum(
  ["new", "preparing", "delivered", "cancelled"],
  { error: "حالة غير صالحة" }
);
