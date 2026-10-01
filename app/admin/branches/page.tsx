import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { BranchesManager } from "@/components/admin/BranchesManager";
import type { Branch } from "@/types/database";

export const metadata: Metadata = {
  title: "الفروع | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage() {
  const supabase = await createClient();
  const [{ data }, { data: orderRows }] = await Promise.all([
    supabase.from("branches").select("*").order("sort_order", { ascending: true }),
    supabase.from("orders").select("branch_id"),
  ]);

  const branchIdsWithOrders = new Set(
    (orderRows ?? []).map((row) => (row as { branch_id: string }).branch_id)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الفروع</h1>
        <p className="text-sm text-stone-500">
          اختر فرعاً لإدارة أصنافه ووجباته، أو استخدم زر «الأصناف» في الجدول.
        </p>
      </div>
      <BranchesManager
        branches={(data ?? []) as Branch[]}
        branchIdsWithOrders={[...branchIdsWithOrders]}
      />
    </div>
  );
}
