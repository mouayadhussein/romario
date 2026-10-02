"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import { updateOrderStatus } from "@/lib/admin-actions";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "./StatusBadge";
import { formatDateTimeAr, formatPrice } from "@/lib/utils";
import { CustomerLocationActions } from "@/components/site/LocationViewModal";
import type { Branch, OrderStatus, OrderWithItems } from "@/types/database";

const statusOptions = [
  { value: "all", label: "كل الحالات" },
  { value: "new", label: "جديد" },
  { value: "preparing", label: "قيد التحضير" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغى" },
];

const orderTypeLabels = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "داخل المطعم",
} as const;

export function OrdersDashboard({
  initialOrders,
  branches,
}: {
  initialOrders: OrderWithItems[];
  branches: Branch[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOrders[0]?.id ?? null
  );
  const [updating, setUpdating] = useState(false);
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAlert = useCallback(() => {
    try {
      if (!audioRef.current) {
        // Short beep via Web Audio API
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // ignore audio errors
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as OrderWithItems;
            const { data: full } = await supabase
              .from("orders")
              .select("*, order_items(*), branches(id, name, slug, whatsapp_number)")
              .eq("id", newRow.id)
              .single();

            if (full) {
              const order = full as unknown as OrderWithItems;
              setOrders((prev) => {
                if (prev.some((o) => o.id === order.id)) return prev;
                return [order, ...prev];
              });
              if (!knownIds.current.has(order.id)) {
                knownIds.current.add(order.id);
                playAlert();
                toast.success(`طلب جديد: ${order.order_number}`, {
                  icon: <Bell className="h-4 w-4" />,
                  duration: 8000,
                });
              }
            }
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as OrderWithItems;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id ? { ...o, ...updated, order_items: o.order_items } : o
              )
            );
          }

          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setOrders((prev) => prev.filter((o) => o.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [playAlert]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (branchFilter !== "all" && o.branch_id !== branchFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, branchFilter, statusFilter]);

  const selected = filtered.find((o) => o.id === selectedId) ?? filtered[0] ?? null;

  async function changeStatus(status: OrderStatus) {
    if (!selected) return;
    setUpdating(true);
    const result = await updateOrderStatus(selected.id, status);
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === selected.id ? { ...o, status } : o))
    );
    toast.success("تم تحديث الحالة");
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="الفرع"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          options={[
            { value: "all", label: "كل الفروع" },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <Select
          label="الحالة"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={statusOptions}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لا توجد طلبات" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <ul className="no-print max-h-[70vh] space-y-2 overflow-y-auto">
            {filtered.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className={`w-full rounded-xl border p-3 text-right transition ${
                    selected?.id === order.id
                      ? "border-brand-500 bg-brand-50"
                      : order.status === "new"
                        ? "border-amber-300 bg-amber-50"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold" dir="ltr">
                      {order.order_number}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-stone-700">{order.customer_name}</p>
                  <p className="text-xs text-stone-500">
                    {formatPrice(Number(order.total))} ·{" "}
                    {formatDateTimeAr(order.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <article
              id="order-print"
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="no-print mb-4 flex flex-wrap gap-2">
                <Select
                  label="تغيير الحالة"
                  value={selected.status}
                  disabled={updating}
                  onChange={(e) => void changeStatus(e.target.value as OrderStatus)}
                  options={statusOptions.filter((o) => o.value !== "all")}
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" />
                    طباعة
                  </Button>
                </div>
              </div>

              <header className="border-b border-stone-200 pb-3">
                <h2 className="text-xl font-bold" dir="ltr">
                  {selected.order_number}
                </h2>
                <p className="text-sm text-stone-500">
                  {selected.branches?.name} ·{" "}
                  {formatDateTimeAr(selected.created_at)}
                </p>
                <div className="mt-2">
                  <StatusBadge status={selected.status} />
                </div>
              </header>

              <section className="mt-4 space-y-1 text-sm">
                <p>
                  <strong>الزبون:</strong> {selected.customer_name}
                </p>
                <p>
                  <strong>الهاتف:</strong>{" "}
                  <span dir="ltr">{selected.customer_phone}</span>
                </p>
                <p>
                  <strong>النوع:</strong> {orderTypeLabels[selected.order_type]}
                </p>
                {selected.customer_address && (
                  <p>
                    <strong>العنوان:</strong> {selected.customer_address}
                  </p>
                )}
                {selected.customer_lat != null &&
                  selected.customer_lng != null && (
                    <p>
                      <strong>الموقع:</strong>{" "}
                      <CustomerLocationActions
                        lat={Number(selected.customer_lat)}
                        lng={Number(selected.customer_lng)}
                      />
                    </p>
                  )}
                {selected.table_number && (
                  <p>
                    <strong>الطاولة:</strong> {selected.table_number}
                  </p>
                )}
                {selected.general_note && (
                  <p>
                    <strong>ملاحظة عامة:</strong> {selected.general_note}
                  </p>
                )}
              </section>

              <section className="mt-4">
                <h3 className="mb-2 font-semibold">الأصناف</h3>
                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {selected.order_items?.map((item) => (
                    <li key={item.id} className="px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span>
                          {item.name_snapshot} × {item.quantity}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(item.price_snapshot) * item.quantity)}
                        </span>
                      </div>
                      {item.note && (
                        <p className="mt-0.5 text-xs text-amber-800">
                          ملاحظة: {item.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-left text-lg font-bold" dir="ltr">
                  المجموع: {formatPrice(Number(selected.total))}
                </p>
                <p className="text-sm text-emerald-700">الدفع: نقداً عند الاستلام</p>
              </section>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
