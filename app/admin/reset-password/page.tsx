"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resetAdminPasswordAction } from "@/lib/admin-password-reset";
import { config } from "@/lib/config";

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-3">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const formData = new FormData(e.currentTarget);
          const result = await resetAdminPasswordAction(formData);
          setLoading(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.");
          router.push("/admin/login");
          router.refresh();
        }}
      >
        <div>
          <h1 className="text-xl font-bold text-stone-900">كلمة مرور جديدة</h1>
          <p className="text-sm text-stone-500">{config.appName} — لوحة التحكم</p>
        </div>
        <Input
          label="كلمة المرور الجديدة"
          name="password"
          type="password"
          required
          minLength={8}
          dir="ltr"
          autoComplete="new-password"
        />
        <Input
          label="تأكيد كلمة المرور"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          dir="ltr"
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" loading={loading}>
          حفظ كلمة المرور
        </Button>
        <p className="text-center text-sm">
          <Link href="/admin/login" className="text-brand-600 hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </p>
      </form>
    </div>
  );
}
