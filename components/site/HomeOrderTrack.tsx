"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ORDER_LOOKUP_FAIL_MESSAGE } from "@/lib/order-lookup";

export function HomeOrderTrack() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
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
        body: JSON.stringify({ orderNumber }),
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
      className="border-t border-stone-200/70 bg-white px-4 py-8"
      dir="rtl"
    >
      <div className="mx-auto max-w-md">
        <h2 className="text-base font-bold text-stone-900">تتبّع طلبك</h2>
        <p className="mt-1 text-xs text-stone-500">
          أدخل رقم الطلب (مثل ORD-0003 أو 3)
        </p>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input
            name="orderNumber"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            placeholder="ORD-0003"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
            className="h-10 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label="رقم الطلب"
          />
          <Button type="submit" loading={loading} className="sm:shrink-0">
            عرض الحالة
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-xs text-amber-800">{error}</p>
        )}
      </div>
    </section>
  );
}
