"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  confirmMfaEnrollAction,
  enrollMfaAction,
  listMfaFactorsAction,
  unenrollMfaAction,
} from "@/lib/admin-actions";

/**
 * Optional admin MFA setup (TOTP).
 * Steps: open while logged in → load factors / start setup → scan QR → confirm code.
 * After enrollment, future logins require /admin/mfa/verify.
 */
export default function AdminMfaSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [factors, setFactors] = useState<
    { id: string; friendly_name?: string; status: string }[]
  >([]);
  const [factorsLoaded, setFactorsLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  async function refreshFactors() {
    const res = await listMfaFactorsAction();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setFactors(res.factors ?? []);
    setFactorsLoaded(true);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">
          المصادقة الثنائية (MFA)
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          فعّل TOTP عبر تطبيق مثل Google Authenticator أو Authy. هذا الخيار
          اختياري لكنه مُستحسن لحسابات الأدمن.
        </p>
      </div>

      {!factorsLoaded ? (
        <Button
          type="button"
          loading={pending}
          onClick={() => {
            startTransition(() => {
              void refreshFactors();
            });
          }}
        >
          تحميل حالة MFA
        </Button>
      ) : (
        <>
          {factors.length > 0 && (
            <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm font-medium text-stone-800">
                العوامل الحالية
              </p>
              <ul className="space-y-2 text-sm text-stone-600">
                {factors.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {f.friendly_name || "TOTP"} — {f.status}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const res = await unenrollMfaAction(f.id);
                        if (res.error) toast.error(res.error);
                        else {
                          toast.success("تم الإلغاء");
                          void refreshFactors();
                        }
                      }}
                    >
                      إلغاء
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!factorId ? (
            <Button
              type="button"
              loading={loading}
              onClick={async () => {
                setLoading(true);
                const res = await enrollMfaAction();
                setLoading(false);
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                setFactorId(res.factorId ?? null);
                setQrCode(res.qrCode ?? null);
                setSecret(res.secret ?? null);
              }}
            >
              بدء الإعداد
            </Button>
          ) : (
            <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCode}
                  alt="QR للمصادقة الثنائية"
                  className="mx-auto h-48 w-48"
                />
              )}
              {secret && (
                <p
                  className="break-all text-center text-xs text-stone-500"
                  dir="ltr"
                >
                  أو أدخل المفتاح يدوياً: {secret}
                </p>
              )}
              <Input
                label="رمز التأكيد"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <Button
                type="button"
                className="w-full"
                loading={loading}
                onClick={async () => {
                  if (!factorId) return;
                  setLoading(true);
                  const res = await confirmMfaEnrollAction(factorId, code);
                  setLoading(false);
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("تم تفعيل المصادقة الثنائية");
                  setFactorId(null);
                  setQrCode(null);
                  setSecret(null);
                  setCode("");
                  void refreshFactors();
                  router.refresh();
                }}
              >
                تأكيد التفعيل
              </Button>
            </div>
          )}
        </>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/admin")}
      >
        العودة للوحة التحكم
      </Button>
    </div>
  );
}
