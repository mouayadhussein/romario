"use client";

import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/Button";
import { config } from "@/lib/config";

export function ImageUpload({
  value,
  onChange,
  folder = "menu",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: config.imageMaxSizeMB,
        maxWidthOrHeight: config.imageMaxWidthOrHeight,
        useWebWorker: true,
      });

      const supabase = createClient();
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("menu-images")
        .upload(path, compressed, { contentType: compressed.type, upsert: false });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("تم رفع الصورة");
    } catch {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">الصورة</label>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-28 w-28 rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          رفع صورة
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            إزالة
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
