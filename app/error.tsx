"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // digest only — never log message/stack to avoid leaking internals to clients
    if (error.digest) {
      console.error(JSON.stringify({ level: "error", digest: error.digest }));
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-stone-900">حدث خطأ</h1>
      <p className="mt-2 text-stone-500">
        تعذّر إكمال الطلب. حاول مرة أخرى أو ارجع للصفحة الرئيسية.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          إعادة المحاولة
        </Button>
        <Link href="/" className="text-brand-700 underline">
          الصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
