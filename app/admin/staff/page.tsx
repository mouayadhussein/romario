import type { Metadata } from "next";
import { createServiceClient } from "@/supabase/admin";
import { StaffManager } from "@/components/admin/StaffManager";
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

  const initialStaff = ((staffRows ?? []) as Staff[]).map((s) => ({
    ...s,
    branch_ids: byStaff.get(s.user_id) ?? [],
  }));

  return (
    <StaffManager
      initialStaff={initialStaff}
      branches={(branches ?? []) as Branch[]}
    />
  );
}
