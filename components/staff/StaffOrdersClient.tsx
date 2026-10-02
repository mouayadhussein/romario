"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Navigation, Package } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import {
  staffClaimOrder,
  staffDeliverOrder,
  staffReleaseOrder,
} from "@/lib/staff-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatPrice, formatDateTimeAr } from "@/lib/utils";
import { mapsDirectionsUrl } from "@/lib/google-maps";
import type { OrderWithItems } from "@/types/database";

type Tab = "available" | "mine" | "delivered";

export function StaffOrdersClient({
  staffId,
  branchIds,
  initialAvailable,
  initialMine,
  initialDeliveredToday,
}: {
  staffId: string;
  branchIds: string[];
  initialAvailable: OrderWithItems[];
  initialMine: OrderWithItems[];
  initialDeliveredToday: OrderWithItems[];
}) {
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState(initialAvailable);
  const [mine, setMine] = useState(initialMine);
  const [delivered, setDelivered] = useState(initialDeliveredToday);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliverOrder, setDeliverOrder] = useState<OrderWithItems | null>(null);
  const [collectedAmount, setCollectedAmount] = useState("");
  const [deliverNote, setDeliverNote] = useState("");
  const [delivering, setDelivering] = useState(false);

  const branchSet = useMemo(() => new Set(branchIds), [branchIds]);

  const startOfDayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const classify = useCallback(
    (order: OrderWithItems) => {
      if (!branchSet.has(order.branch_id)) return null;
      if (order.deleted_at) return "remove" as const;
      if (
        order.status === "ready" &&
        order.order_type === "delivery" &&
        !order.assigned_to
      ) {
        return "available" as const;
      }
      if (order.status === "on_the_way" && order.assigned_to === staffId) {
        return "mine" as const;
      }
      if (
        order.status === "delivered" &&
        order.assigned_to === staffId &&
        order.delivered_at &&
        order.delivered_at >= startOfDayIso
      ) {
        return "delivered" as const;
      }
      return "remove" as const;
    },
    [branchSet, staffId, startOfDayIso]
  );

  const upsertOrder = useCallback(
    (order: OrderWithItems) => {
      const bucket = classify(order);
      setAvailable((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        if (bucket === "available") {
          return [...without, order].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          );
        }
        return without;
      });
      setMine((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        if (bucket === "mine") return [...without, order];
        return without;
      });
      setDelivered((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        if (bucket === "delivered") return [order, ...without];
        return without;
      });
    },
    [classify]
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("staff-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAvailable((p) => p.filter((o) => o.id !== old.id));
            setMine((p) => p.filter((o) => o.id !== old.id));
            setDelivered((p) => p.filter((o) => o.id !== old.id));
            return;
          }

          const row = payload.new as OrderWithItems;
          if (!branchSet.has(row.branch_id)) return;

          const { data: full } = await supabase
            .from("orders")
            .select(
              "*, order_items(*), branches(id, name, slug, whatsapp_number)"
            )
            .eq("id", row.id)
            .maybeSingle();

          if (full) upsertOrder(full as unknown as OrderWithItems);
          else upsertOrder(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchSet, upsertOrder]);

  async function claim(orderId: string) {
    setBusyId(orderId);
    const result = await staffClaimOrder(orderId);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم استلام الطلب");
    setTab("mine");
  }

  async function release(orderId: string) {
    setBusyId(orderId);
    const result = await staffReleaseOrder(orderId);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم التراجع عن الاستلام");
  }

  async function confirmDeliver() {
    if (!deliverOrder) return;
    const amount = Number(collectedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("أدخل مبلغاً صالحاً");
      return;
    }
    setDelivering(true);
    const result = await staffDeliverOrder({
      orderId: deliverOrder.id,
      collectedAmount: amount,
      note: deliverNote || null,
      expectedTotal: Number(deliverOrder.total),
    });
    setDelivering(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم تأكيد التوصيل");
    setDeliverOrder(null);
    setCollectedAmount("");
    setDeliverNote("");
    setTab("delivered");
  }

  const list =
    tab === "available" ? available : tab === "mine" ? mine : delivered;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "available", label: "متاحة", count: available.length },
    { id: "mine", label: "طلباتي", count: mine.length },
    { id: "delivered", label: "تم توصيلها اليوم", count: delivered.length },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold text-stone-900">طلبات التوصيل</h1>

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
              tab === t.id
                ? "bg-brand-600 text-white"
                : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            {t.label}
            <span className="ms-1 opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="لا توجد طلبات في هذه القائمة" />
      ) : (
        <ul className="space-y-3">
          {list.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold" dir="ltr">
                    {order.order_number}
                  </p>
                  <p className="text-sm text-stone-600">
                    {order.branches?.name}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <strong>الزبون:</strong> {order.customer_name}
                </p>
                {order.customer_address && (
                  <p>
                    <strong>العنوان:</strong> {order.customer_address}
                  </p>
                )}
                <p className="font-semibold text-brand-700">
                  التحصيل: {formatPrice(Number(order.total))}
                </p>
                <p className="text-xs text-stone-500">
                  {formatDateTimeAr(order.created_at)}
                </p>
              </div>

              {order.order_items?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      {item.name_snapshot} × {item.quantity}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`tel:${order.customer_phone}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700"
                >
                  <Phone className="h-4 w-4" />
                  اتصال
                </a>
                {order.customer_lat != null && order.customer_lng != null && (
                  <a
                    href={mapsDirectionsUrl(
                      Number(order.customer_lat),
                      Number(order.customer_lng)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700"
                  >
                    <Navigation className="h-4 w-4" />
                    الاتجاهات
                  </a>
                )}
              </div>

              {tab === "available" && (
                <Button
                  className="mt-3 w-full"
                  loading={busyId === order.id}
                  disabled={busyId != null}
                  onClick={() => void claim(order.id)}
                >
                  استلام الطلب
                </Button>
              )}

              {tab === "mine" && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    loading={busyId === order.id && delivering}
                    disabled={busyId != null}
                    onClick={() => {
                      setDeliverOrder(order);
                      setCollectedAmount(String(Number(order.total)));
                      setDeliverNote("");
                    }}
                  >
                    <Package className="h-4 w-4" />
                    تأكيد التوصيل
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    loading={busyId === order.id && !delivering}
                    disabled={busyId != null}
                    onClick={() => void release(order.id)}
                  >
                    تراجع
                  </Button>
                </div>
              )}

              {tab === "delivered" && order.collected_amount != null && (
                <p className="mt-2 text-sm text-emerald-700">
                  حُصّل: {formatPrice(Number(order.collected_amount))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={deliverOrder != null}
        onClose={() => setDeliverOrder(null)}
        title="تحصيل المبلغ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeliverOrder(null)}>
              إلغاء
            </Button>
            <Button loading={delivering} onClick={() => void confirmDeliver()}>
              تأكيد
            </Button>
          </>
        }
      >
        {deliverOrder && (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              إجمالي الطلب:{" "}
              <strong>{formatPrice(Number(deliverOrder.total))}</strong>
            </p>
            <Input
              label="المبلغ المحصّل"
              type="number"
              dir="ltr"
              min={0}
              step="0.01"
              value={collectedAmount}
              onChange={(e) => setCollectedAmount(e.target.value)}
            />
            <Textarea
              label="ملاحظة (مطلوبة عند اختلاف المبلغ)"
              value={deliverNote}
              onChange={(e) => setDeliverNote(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
