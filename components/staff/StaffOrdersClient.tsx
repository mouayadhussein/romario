"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, Navigation, Package, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import {
  staffClaimOrder,
  staffDeliverOrder,
  staffReleaseOrder,
} from "@/lib/staff-actions";
import {
  ORDER_FULL_SELECT,
  subscribeOrdersRealtime,
  type OrdersRealtimeStatus,
} from "@/lib/orders-realtime";
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
  const [rtStatus, setRtStatus] = useState<OrdersRealtimeStatus>("connecting");

  const branchSet = useMemo(() => new Set(branchIds), [branchIds]);
  const staffIdRef = useRef(staffId);
  const branchIdsRef = useRef(branchIds);
  const deliverOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    staffIdRef.current = staffId;
  }, [staffId]);
  useEffect(() => {
    branchIdsRef.current = branchIds;
  }, [branchIds]);
  useEffect(() => {
    deliverOrderIdRef.current = deliverOrder?.id ?? null;
  }, [deliverOrder?.id]);

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

      if (
        deliverOrderIdRef.current === order.id &&
        (order.assigned_to !== staffIdRef.current ||
          order.status === "cancelled" ||
          order.deleted_at)
      ) {
        setDeliverOrder(null);
      }
    },
    [classify]
  );

  const removeOrder = useCallback((id: string) => {
    setAvailable((p) => p.filter((o) => o.id !== id));
    setMine((p) => p.filter((o) => o.id !== id));
    setDelivered((p) => p.filter((o) => o.id !== id));
    if (deliverOrderIdRef.current === id) setDeliverOrder(null);
  }, []);

  const refetchLists = useCallback(async () => {
    const ids = branchIdsRef.current;
    if (ids.length === 0) {
      setAvailable([]);
      setMine([]);
      setDelivered([]);
      return;
    }
    const supabase = createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sid = staffIdRef.current;

    const [{ data: avail }, { data: my }, { data: del }] = await Promise.all([
      supabase
        .from("orders")
        .select(ORDER_FULL_SELECT)
        .eq("status", "ready")
        .eq("order_type", "delivery")
        .is("assigned_to", null)
        .is("deleted_at", null)
        .in("branch_id", ids)
        .order("created_at", { ascending: true })
        .limit(50),
      supabase
        .from("orders")
        .select(ORDER_FULL_SELECT)
        .eq("status", "on_the_way")
        .eq("assigned_to", sid)
        .is("deleted_at", null)
        .order("claimed_at", { ascending: true })
        .limit(50),
      supabase
        .from("orders")
        .select(ORDER_FULL_SELECT)
        .eq("status", "delivered")
        .eq("assigned_to", sid)
        .is("deleted_at", null)
        .gte("delivered_at", start.toISOString())
        .order("delivered_at", { ascending: false })
        .limit(50),
    ]);

    setAvailable((avail ?? []) as unknown as OrderWithItems[]);
    setMine((my ?? []) as unknown as OrderWithItems[]);
    setDelivered((del ?? []) as unknown as OrderWithItems[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    return subscribeOrdersRealtime({
      onStatus: setRtStatus,
      onRefetchNeeded: () => {
        void refetchLists();
      },
      onChange: async (change) => {
        if (change.eventType === "DELETE") {
          removeOrder(change.row.id);
          return;
        }

        const row = change.row;
        if (
          row.branch_id &&
          !branchIdsRef.current.includes(String(row.branch_id))
        ) {
          removeOrder(row.id);
          return;
        }

        const { data: full } = await supabase
          .from("orders")
          .select(ORDER_FULL_SELECT)
          .eq("id", row.id)
          .maybeSingle();

        if (!full) {
          // Soft-deleted or out of RLS — drop from lists
          removeOrder(row.id);
          return;
        }
        upsertOrder(full as unknown as OrderWithItems);
      },
    });
  }, [refetchLists, removeOrder, upsertOrder]);

  async function claim(orderId: string) {
    setBusyId(orderId);
    const result = await staffClaimOrder(orderId);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      void refetchLists();
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-stone-900">طلبات التوصيل</h1>
        {rtStatus === "disconnected" && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
            <WifiOff className="h-3 w-3" />
            غير متصل
          </span>
        )}
      </div>

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
