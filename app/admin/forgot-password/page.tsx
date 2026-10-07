"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestAdminPasswordResetAction } from "@/lib/admin-password-reset";
import { config } from "@/lib/config";

export default function AdminForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "invalid_link") {
      toast.error("رابط إعادة التعيين غير صالح أو منتهي. اطلب رابطاً جديداً.");
    }
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-3">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const formData = new FormData(e.currentTarget);
          const result = await requestAdminPasswordResetAction(formData);
          setLoading(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setSent(true);
          if (result.message) toast.success(result.message);
        }}
      >
        <div>
          <h1 className="text-xl font-bold text-stone-900">نسيت كلمة المرور؟</h1>
          <p className="text-sm text-stone-500">
            {config.appName} — أدخل البريد المرتبط بحساب المدير
          </p>
        </div>
        {!sent ? (
          <>
            <Input
              label="البريد الإلكتروني"
              name="email"
              type="email"
              required
              dir="ltr"
              autoComplete="email"
            />
            <Button type="submit" className="w-full" loading={loading}>
              إرسال رابط إعادة التعيين
            </Button>
          </>
        ) : (
          <p className="text-sm text-stone-600">
            تحقّق من بريدك (ومجلد الرسائل غير المرغوب فيها). بعد فتح الرابط يمكنك
            اختيار كلمة مرور جديدة.
          </p>
        )}
        <p className="text-center text-sm">
          <Link href="/admin/login" className="text-brand-600 hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </p>
      </form>
    </div>
  );
}
