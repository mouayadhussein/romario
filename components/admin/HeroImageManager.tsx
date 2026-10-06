"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { saveHeroImageAction } from "@/lib/admin-actions";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";

export function HeroImageManager({
  initialImageUrl,
}: {
  initialImageUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);

  const previewUrl = imageUrl || DEFAULT_HERO_IMAGE;
  const isCustom = Boolean(imageUrl);

  function handleSave() {
    startTransition(async () => {
      const result = await saveHeroImageAction({ image_url: imageUrl });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        isCustom ? "تم حفظ صورة الصفحة الرئيسية" : "تم استعادة الصورة الافتراضية"
      );
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
      <h2 className="text-lg font-bold text-stone-900">صورة الصفحة الرئيسية</h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-500">
        الصورة الكبيرة في أعلى الموقع (هيرو). ارفع صورة من جهازك ثم احفظ.
        عند الإزالة تُعاد الصورة الافتراضية.
      </p>

      <div className="mt-4 space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-stone-100 sm:aspect-21/9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="معاينة صورة الصفحة الرئيسية"
            className="h-full w-full object-cover"
          />
        </div>

        <ImageUpload
          value={imageUrl}
          folder="hero"
          onChange={(url) => setImageUrl(url)}
        />

        {!isCustom && (
          <p className="text-xs text-stone-500">
            حالياً تُعرض الصورة الافتراضية للموقع.
          </p>
        )}

        <Button type="button" onClick={handleSave} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "جاري الحفظ..." : "حفظ الصورة"}
        </Button>
      </div>
    </div>
  );
}
