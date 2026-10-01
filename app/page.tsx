import { createClient } from "@/supabase/server";
import { BranchCard } from "@/components/site/BranchCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { config } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import type { Branch } from "@/types/database";
import type { Metadata } from "next";

const t = getDictionary("ar").site;

export const metadata: Metadata = {
  title: t.branchesTitle,
  description: t.branchesSubtitle,
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const branches = (data ?? []) as Branch[];

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-brand-800 to-brand-900 px-4 pb-16 pt-10 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-brand-500">{config.appName}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.branchesTitle}</h1>
          <p className="mt-2 text-stone-300">{t.branchesSubtitle}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-3xl px-4 pb-16">
        {error ? (
          <EmptyState title="تعذّر تحميل الفروع" description={error.message} />
        ) : branches.length === 0 ? (
          <EmptyState title={t.noBranches} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {branches.map((branch) => (
              <BranchCard key={branch.id} branch={branch} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
