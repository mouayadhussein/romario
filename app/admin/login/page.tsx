"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginAction } from "@/lib/admin-actions";
import { config } from "@/lib/config";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const formData = new FormData(e.currentTarget);
          const result = await loginAction(formData);
          setLoading(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.needsMfa) {
            router.push("/admin/mfa/verify");
            router.refresh();
            return;
          }
          router.push("/admin");
          router.refresh();
        }}
      >
        <div>
          <h1 className="text-xl font-bold text-stone-900">تسجيل الدخول</h1>
          <p className="text-sm text-stone-500">
            {config.appName} — لوحة التحكم
          </p>
        </div>
        <Input
          label="البريد الإلكتروني"
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
        />
        <Input
          label="كلمة المرور"
          name="password"
          type="password"
          required
          dir="ltr"
          autoComplete="current-password"
        />
        <p className="text-left text-sm">
          <Link
            href="/admin/forgot-password"
            className="text-brand-600 hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </p>
        <Button type="submit" className="w-full" loading={loading}>
          دخول
        </Button>
      </form>
    </div>
  );
}
