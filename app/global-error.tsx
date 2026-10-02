"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error(JSON.stringify({ level: "error", digest: error.digest }));
    }
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-stone-50 text-stone-900">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-bold">حدث خطأ غير متوقع</h1>
          <p className="mt-2 text-stone-500">
            نعمل على إصلاح المشكلة. حاول تحديث الصفحة.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            onClick={reset}
          >
            تحديث
          </button>
        </main>
      </body>
    </html>
  );
}
