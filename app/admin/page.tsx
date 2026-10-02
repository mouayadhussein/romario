import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { createServiceClient } from "@/supabase/admin";
import { OrdersDashboard } from "@/components/admin/OrdersDashboard";
import type { Branch, OrderEvent, OrderWithItems, Staff } from "@/types/database";

export const metadata: Metadata = {
  title: "الطلبات | لوحة التحكم",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const admin = createServiceClient();

  const [{ data: orders }, { data: branches }, { data: staff }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*), branches(id, name, slug, whatsapp_number)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("branches").select("*").order("sort_order", { ascending: true }),
      admin
        .from("staff")
        .select("user_id, full_name, phone, is_active, created_at")
        .eq("is_active", true)
        .order("full_name"),
    ]);

  const staffById = new Map(
    ((staff ?? []) as Staff[]).map((s) => [s.user_id, s])
  );

  const enriched = ((orders ?? []) as unknown as OrderWithItems[]).map(
    (order) => {
      const s = order.assigned_to
        ? staffById.get(order.assigned_to)
        : undefined;
      return {
        ...order,
        staff: s
          ? {
              user_id: s.user_id,
              full_name: s.full_name,
              phone: s.phone,
            }
          : null,
      };
    }
  );

  const orderIds = enriched.map((o) => o.id);
  const eventsByOrder: Record<string, OrderEvent[]> = {};
  if (orderIds.length > 0) {
    const { data: events } = await supabase
      .from("order_events")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const ev of events ?? []) {
      const list = eventsByOrder[ev.order_id] ?? [];
      list.push(ev as OrderEvent);
      eventsByOrder[ev.order_id] = list;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="no-print text-2xl font-bold text-stone-900">الطلبات</h1>
      <OrdersDashboard
        initialOrders={enriched}
        branches={(branches ?? []) as Branch[]}
        staffList={(staff ?? []) as Staff[]}
        eventsByOrder={eventsByOrder}
      />
    </div>
  );
}
