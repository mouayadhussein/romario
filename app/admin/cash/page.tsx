import type { Metadata } from "next";
import { createServiceClient } from "@/supabase/admin";
import { CashSettlementClient } from "@/components/admin/CashSettlementClient";

export const metadata: Metadata = {
  title: "تسوية النقد | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminCashPage() {
  const admin = createServiceClient();

  const { data: staffRows } = await admin
    .from("staff")
    .select("user_id, full_name")
    .eq("is_active", true)
    .order("full_name");

  const staff = await Promise.all(
    (staffRows ?? []).map(async (s) => {
      const [{ data: collected }, { data: settlements }] = await Promise.all([
        admin
          .from("orders")
          .select("collected_amount")
          .eq("assigned_to", s.user_id)
          .eq("status", "delivered")
          .not("collected_amount", "is", null),
        admin
          .from("cash_settlements")
          .select("amount")
          .eq("staff_id", s.user_id),
      ]);

      return {
        user_id: s.user_id,
        full_name: s.full_name,
        collected: (collected ?? []).map((r) => Number(r.collected_amount)),
        settlements: (settlements ?? []).map((r) => Number(r.amount)),
      };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-900">تسوية النقد</h1>
      <p className="text-sm text-stone-500">
        سجّل المبالغ التي سلّمها موظف التوصيل للإدارة.
      </p>
      <CashSettlementClient staff={staff} />
    </div>
  );
}
