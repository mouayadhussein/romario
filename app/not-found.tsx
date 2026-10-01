import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-stone-900">الصفحة غير موجودة</h1>
      <p className="mt-2 text-stone-500">تأكد من الرابط أو عد إلى الصفحة الرئيسية</p>
      <Link href="/" className="mt-6 text-brand-700 underline">
        الصفحة الرئيسية
      </Link>
    </main>
  );
}
