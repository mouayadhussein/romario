import type { Metadata } from "next";
import { createServiceClient } from "@/supabase/admin";
import { StaffManager } from "@/components/admin/StaffManager";
import { staffHasRecords } from "@/lib/staff-guards";
import type { Branch, Staff } from "@/types/database";

export const metadata: Metadata = {
  title: "الموظفون | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const admin = createServiceClient();

  const [{ data: staffRows }, { data: links }, { data: branches }] =
    await Promise.all([
      admin.from("staff").select("*").order("created_at", { ascending: false }),
      admin.from("staff_branches").select("staff_id, branch_id"),
      admin.from("branches").select("*").order("sort_order", { ascending: true }),
    ]);

  const byStaff = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = byStaff.get(link.staff_id) ?? [];
    list.push(link.branch_id);
    byStaff.set(link.staff_id, list);
  }

  const staffList = (staffRows ?? []) as Staff[];

  const counts = await Promise.all(
    staffList.map(async (s) => {
      const [{ count: assignedOrderCount }, { count: settlementCount }] =
        await Promise.all([
          admin
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", s.user_id),
          admin
            .from("cash_settlements")
            .select("*", { count: "exact", head: true })
            .eq("staff_id", s.user_id),
        ]);
      return {
        user_id: s.user_id,
        has_records: staffHasRecords({
          assignedOrderCount: assignedOrderCount ?? 0,
          settlementCount: settlementCount ?? 0,
        }),
      };
    })
  );

  const hasRecordsMap = new Map(counts.map((c) => [c.user_id, c.has_records]));

  const initialStaff = staffList.map((s) => ({
    ...s,
    branch_ids: byStaff.get(s.user_id) ?? [],
    has_records: hasRecordsMap.get(s.user_id) ?? false,
  }));

  return (
    <StaffManager
      initialStaff={initialStaff}
      branches={(branches ?? []) as Branch[]}
    />
  );
}
