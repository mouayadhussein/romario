import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { StaffOrdersClient } from "@/components/staff/StaffOrdersClient";
import type { OrderWithItems } from "@/types/database";

export const metadata: Metadata = {
  title: "طلبات التوصيل",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: branchLinks } = await supabase
    .from("staff_branches")
    .select("branch_id")
    .eq("staff_id", user.id);

  const branchIds = (branchLinks ?? []).map((b) => b.branch_id);

  const empty = branchIds.length === 0;

  const [{ data: available }, { data: mine }, { data: deliveredToday }] =
    empty
      ? [{ data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
          supabase
            .from("orders")
            .select(
              "*, order_items(*), branches(id, name, slug, whatsapp_number)"
            )
            .eq("status", "ready")
            .eq("order_type", "delivery")
            .is("assigned_to", null)
            .is("deleted_at", null)
            .in("branch_id", branchIds)
            .order("created_at", { ascending: true })
            .limit(50),
          supabase
            .from("orders")
            .select(
              "*, order_items(*), branches(id, name, slug, whatsapp_number)"
            )
            .eq("status", "on_the_way")
            .eq("assigned_to", user.id)
            .is("deleted_at", null)
            .order("claimed_at", { ascending: true })
            .limit(50),
          supabase
            .from("orders")
            .select(
              "*, order_items(*), branches(id, name, slug, whatsapp_number)"
            )
            .eq("status", "delivered")
            .eq("assigned_to", user.id)
            .is("deleted_at", null)
            .gte("delivered_at", startOfDay.toISOString())
            .order("delivered_at", { ascending: false })
            .limit(50),
        ]);

  return (
    <StaffOrdersClient
      staffId={user.id}
      branchIds={branchIds}
      initialAvailable={(available ?? []) as unknown as OrderWithItems[]}
      initialMine={(mine ?? []) as unknown as OrderWithItems[]}
      initialDeliveredToday={
        (deliveredToday ?? []) as unknown as OrderWithItems[]
      }
    />
  );
}
