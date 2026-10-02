"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { verifyMfaAction, logoutAction } from "@/lib/admin-actions";

export default function AdminMfaVerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const result = await verifyMfaAction(code);
          setLoading(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          router.push("/admin");
          router.refresh();
        }}
      >
        <div>
          <h1 className="text-xl font-bold text-stone-900">التحقق الثنائي</h1>
          <p className="mt-1 text-sm text-stone-500">
            أدخل الرمز من تطبيق المصادقة (6 أرقام)
          </p>
        </div>
        <Input
          label="رمز التحقق"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          تأكيد
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await logoutAction();
            router.push("/admin/login");
            router.refresh();
          }}
        >
          إلغاء وتسجيل الخروج
        </Button>
      </form>
    </div>
  );
}
