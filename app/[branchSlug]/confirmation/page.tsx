import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary("ar").site;

export const metadata: Metadata = {
  title: "تأكيد الطلب",
};

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchSlug: string }>;
  searchParams: Promise<{ order?: string; tracking?: string }>;
}) {
  const { branchSlug } = await params;
  const { order, tracking } = await searchParams;

  return (
    <>
      <SiteHeader showBack branchSlug={branchSlug} />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-stone-900">{t.orderSuccess}</h1>
        {order && (
          <p className="mt-2 text-lg">
            {t.orderNumber}:{" "}
            <span className="font-bold text-brand-700" dir="ltr">
              {order}
            </span>
          </p>
        )}
        <p className="mt-3 text-sm text-stone-500">{t.orderConfirmationHint}</p>
        {tracking && (
          <Link href={`/order/${tracking}`} className="mt-4">
            <Button variant="outline" size="lg">
              تتبع الطلب
            </Button>
          </Link>
        )}
        <Link href={`/${branchSlug}`} className="mt-8">
          <Button size="lg">{t.backToMenu}</Button>
        </Link>
      </main>
    </>
  );
}
