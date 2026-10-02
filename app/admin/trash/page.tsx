import type { Metadata } from "next";
import { createServiceClient } from "@/supabase/admin";
import { TrashOrdersClient } from "@/components/admin/TrashOrdersClient";

export const metadata: Metadata = {
  title: "المحذوفات | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminTrashPage() {
  const admin = createServiceClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, customer_name, total, status, deleted_at, branches(name)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-900">سلة المحذوفات</h1>
      <TrashOrdersClient
        initialOrders={(orders ?? []) as {
          id: string;
          order_number: string;
          customer_name: string;
          total: number;
          status: import("@/types/database").OrderStatus;
          deleted_at: string | null;
          branches?: { name: string } | null;
        }[]}
      />
    </div>
  );
}
