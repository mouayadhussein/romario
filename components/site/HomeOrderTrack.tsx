"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ORDER_LOOKUP_FAIL_MESSAGE } from "@/lib/order-lookup";

export function HomeOrderTrack() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, phone }),
      });
      const json = (await res.json()) as {
        trackingToken?: string;
        error?: string;
      };
      if (!res.ok || !json.trackingToken) {
        setError(json.error ?? ORDER_LOOKUP_FAIL_MESSAGE);
        return;
      }
      router.push(`/order/${json.trackingToken}`);
    } catch {
      setError(ORDER_LOOKUP_FAIL_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="track-order"
      className="scroll-mt-28 border-t border-stone-200/70 bg-[#f7f6f4] px-4 py-12 sm:py-14"
      dir="rtl"
    >
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center sm:text-start">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1 text-xs font-bold text-brand-500">
            <PackageSearch className="h-3.5 w-3.5" />
            التتبع
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-brand-900">
            تتبّع طلبك
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            أدخل رقم الطلب ورقم هاتفك كما سجّلته عند الطلب لعرض الحالة.
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_8px_30px_rgba(18,18,18,0.06)] sm:p-5"
        >
          <Input
            label="رقم الطلب"
            name="orderNumber"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            placeholder="مثال: ORD-0003 أو 3"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
          <Input
            label="رقم الهاتف"
            name="phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="نفس الرقم المستخدم في الطلب"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className="text-xs text-stone-500">
            يمكنك كتابة الرقم القصير فقط (مثل 3) أو الكامل ORD-0003.
          </p>
          {error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            عرض حالة الطلب
          </Button>
        </form>
      </div>
    </section>
  );
}
