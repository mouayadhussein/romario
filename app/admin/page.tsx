import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { OrdersDashboard } from "@/components/admin/OrdersDashboard";
import type { Branch, OrderWithItems } from "@/types/database";

export const metadata: Metadata = {
  title: "الطلبات | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: branches }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), branches(id, name, slug, whatsapp_number)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("branches").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="no-print text-2xl font-bold text-stone-900">الطلبات</h1>
      <OrdersDashboard
        initialOrders={(orders ?? []) as unknown as OrderWithItems[]}
        branches={(branches ?? []) as Branch[]}
      />
    </div>
  );
}
