"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Printer, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import {
  updateOrderStatus,
  softDeleteOrder,
  cancelOrderAction,
  assignOrderStaff,
} from "@/lib/order-actions";
import {
  OPEN_ORDER_EVENT,
  ORDER_FULL_SELECT,
  subscribeOrdersRealtime,
  type OrdersRealtimeStatus,
} from "@/lib/orders-realtime";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "./StatusBadge";
import { cn, formatDateTimeAr, formatPrice } from "@/lib/utils";
import { CustomerLocationActions } from "@/components/site/LocationViewModal";
import {
  CANCEL_REASON_OPTIONS,
  ORDER_STATUS_LABELS,
  type CancelReasonCode,
} from "@/lib/order-status";
import type {
  Branch,
  OrderEvent,
  OrderStatus,
  OrderWithItems,
  Staff,
} from "@/types/database";

const statusOptions = [
  { value: "all", label: "كل الحالات" },
  { value: "new", label: "جديد" },
  { value: "preparing", label: "قيد التحضير" },
  { value: "ready", label: "جاهز" },
  { value: "on_the_way", label: "بالطريق" },
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
  staffList = [],
  eventsByOrder = {},
}: {
  initialOrders: OrderWithItems[];
  branches: Branch[];
  staffList?: Staff[];
  eventsByOrder?: Record<string, OrderEvent[]>;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [eventsMap, setEventsMap] = useState(eventsByOrder);
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] =
    useState<CancelReasonCode>("customer_cancelled");
  const [cancelText, setCancelText] = useState("");
  const [rtStatus, setRtStatus] = useState<OrdersRealtimeStatus>("connecting");
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));
  const selectedIdRef = useRef(selectedId);
  const ordersRef = useRef(orders);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const refreshEvents = useCallback(async (orderId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("order_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) {
      setEventsMap((prev) => ({
        ...prev,
        [orderId]: data as OrderEvent[],
      }));
    }
  }, []);

  const openOrder = useCallback(
    async (orderId: string) => {
      setSelectedId(orderId);
      setStatusFilter("all");
      setBranchFilter("all");

      const exists = ordersRef.current.some((o) => o.id === orderId);
      if (!exists) {
        const supabase = createClient();
        const { data: full } = await supabase
          .from("orders")
          .select(ORDER_FULL_SELECT)
          .eq("id", orderId)
          .is("deleted_at", null)
          .maybeSingle();
        if (full) {
          const order = full as unknown as OrderWithItems;
          knownIds.current.add(order.id);
          setOrders((prev) => [
            order,
            ...prev.filter((o) => o.id !== order.id),
          ]);
        }
      }

      void refreshEvents(orderId);

      window.setTimeout(() => {
        document
          .getElementById(`admin-order-${orderId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    [refreshEvents]
  );

  const toggleOrder = useCallback(
    (orderId: string) => {
      if (selectedIdRef.current === orderId) {
        setSelectedId(null);
        return;
      }
      setSelectedId(orderId);
      void refreshEvents(orderId);
      window.setTimeout(() => {
        document
          .getElementById(`admin-order-${orderId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    },
    [refreshEvents]
  );

  const refetchOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(ORDER_FULL_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      const list = data as unknown as OrderWithItems[];
      setOrders(list);
      for (const o of list) knownIds.current.add(o.id);
    }
    const sid = selectedIdRef.current;
    if (sid) void refreshEvents(sid);
  }, [refreshEvents]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ orderId: string }>).detail;
      if (detail?.orderId) void openOrder(detail.orderId);
    };
    window.addEventListener(OPEN_ORDER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ORDER_EVENT, onOpen);
  }, [openOrder]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (!id) return;
    const t = window.setTimeout(() => {
      void openOrder(id);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    const supabase = createClient();
    return subscribeOrdersRealtime({
      onStatus: setRtStatus,
      onRefetchNeeded: () => {
        void refetchOrders();
      },
      onChange: async (change) => {
        if (change.eventType === "DELETE") {
          setOrders((prev) => prev.filter((o) => o.id !== change.row.id));
          if (selectedIdRef.current === change.row.id) setSelectedId(null);
          return;
        }

        if (change.row.deleted_at) {
          setOrders((prev) => prev.filter((o) => o.id !== change.row.id));
          if (selectedIdRef.current === change.row.id) setSelectedId(null);
          return;
        }

        const { data: full } = await supabase
          .from("orders")
          .select(ORDER_FULL_SELECT)
          .eq("id", change.row.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (!full) {
          setOrders((prev) => prev.filter((o) => o.id !== change.row.id));
          if (selectedIdRef.current === change.row.id) setSelectedId(null);
          return;
        }

        const order = full as unknown as OrderWithItems;
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === order.id);
          if (idx === -1) {
            knownIds.current.add(order.id);
            return [order, ...prev];
          }
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            ...order,
            order_items: order.order_items?.length
              ? order.order_items
              : next[idx].order_items,
            branches: order.branches ?? next[idx].branches,
            staff: order.staff ?? next[idx].staff,
          };
          return next;
        });

        if (selectedIdRef.current === order.id) {
          void refreshEvents(order.id);
        }
      },
    });
  }, [refetchOrders, refreshEvents]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (o.deleted_at) return false;
      if (branchFilter !== "all" && o.branch_id !== branchFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, branchFilter, statusFilter]);

  const selected = filtered.find((o) => o.id === selectedId) ?? null;
  const selectedEvents = selected ? eventsMap[selected.id] ?? [] : [];

  async function changeStatus(status: OrderStatus) {
    if (!selected) return;
    if (status === "cancelled") {
      setCancelOpen(true);
      return;
    }
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

  async function handleSoftDelete() {
    if (!selected) return;
    const collected =
      selected.collected_amount != null
        ? Number(selected.collected_amount)
        : null;
    const hasCash =
      selected.status === "delivered" &&
      collected != null &&
      Number.isFinite(collected) &&
      collected > 0;
    const msg = hasCash
      ? `تحذير: هذا الطلب موصّل وعليه مبلغ محصّل (${collected}). سيبقى المبلغ ضمن رصيد الموظف بعد النقل لسلة المحذوفات. هل تريد المتابعة؟`
      : "نقل الطلب إلى سلة المحذوفات؟";
    if (!confirm(msg)) return;
    setUpdating(true);
    const result = await softDeleteOrder(selected.id);
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== selected.id));
    setSelectedId(null);
    toast.success(
      hasCash
        ? "تم الحذف مع الإبقاء على المبلغ في رصيد الموظف"
        : "تم الحذف"
    );
  }

  async function handleAssign(staffId: string) {
    if (!selected) return;
    setUpdating(true);
    const result = await assignOrderStaff(
      selected.id,
      staffId === "" ? null : staffId
    );
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const staffMember = staffList.find((s) => s.user_id === staffId) ?? null;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selected.id
          ? {
              ...o,
              assigned_to: staffId || null,
              status: staffId
                ? ("on_the_way" as const)
                : o.status === "on_the_way"
                  ? ("ready" as const)
                  : o.status,
              staff: staffMember
                ? {
                    user_id: staffMember.user_id,
                    full_name: staffMember.full_name,
                    phone: staffMember.phone,
                  }
                : null,
            }
          : o
      )
    );
    toast.success(staffId ? "تم التعيين" : "تم إلغاء التعيين");
  }

  async function confirmCancel() {
    if (!selected) return;
    setUpdating(true);
    const result = await cancelOrderAction({
      orderId: selected.id,
      reasonCode: cancelReason,
      reasonText: cancelText || null,
    });
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selected.id
          ? {
              ...o,
              status: "cancelled" as const,
              cancel_reason:
                CANCEL_REASON_OPTIONS.find((r) => r.code === cancelReason)
                  ?.label ?? cancelText,
            }
          : o
      )
    );
    setCancelOpen(false);
    toast.success("تم إلغاء الطلب");
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip">
      <div className="no-print flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
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
        {rtStatus === "disconnected" && (
          <span className="inline-flex items-center gap-1 self-center rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
            <WifiOff className="h-3 w-3" />
            غير متصل
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لا توجد طلبات" />
      ) : (
        <ul className="mx-auto max-w-3xl space-y-2">
          {filtered.map((order) => {
            const expanded = selected?.id === order.id;
            return (
              <li key={order.id} id={`admin-order-${order.id}`} className="min-w-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggleOrder(order.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl border p-3 text-right transition",
                    expanded
                      ? "border-brand-500 bg-brand-50"
                      : order.status === "new"
                        ? "border-amber-300 bg-amber-50 hover:bg-amber-100/70"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold" dir="ltr">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-sm text-stone-700">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatPrice(Number(order.total))} ·{" "}
                      {formatDateTimeAr(order.created_at)}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200",
                      expanded && "rotate-180 text-brand-600"
                    )}
                    aria-hidden
                  />
                </button>

                {expanded && selected && (
                  <div className="mt-2 animate-section-rise">
                    <OrderDetailsPanel
                      order={selected}
                      events={selectedEvents}
                      staffList={staffList}
                      updating={updating}
                      onChangeStatus={(s) => void changeStatus(s)}
                      onCancel={() => setCancelOpen(true)}
                      onDelete={() => void handleSoftDelete()}
                      onAssign={(id) => void handleAssign(id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="إلغاء الطلب"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              رجوع
            </Button>
            <Button loading={updating} onClick={() => void confirmCancel()}>
              تأكيد الإلغاء
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="السبب"
            value={cancelReason}
            onChange={(e) =>
              setCancelReason(e.target.value as CancelReasonCode)
            }
            options={CANCEL_REASON_OPTIONS.map((o) => ({
              value: o.code,
              label: o.label,
            }))}
          />
          {cancelReason === "other" && (
            <Textarea
              label="تفاصيل السبب"
              value={cancelText}
              onChange={(e) => setCancelText(e.target.value)}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

function OrderDetailsPanel({
  order,
  events,
  staffList,
  updating,
  onChangeStatus,
  onCancel,
  onDelete,
  onAssign,
}: {
  order: OrderWithItems;
  events: OrderEvent[];
  staffList: Staff[];
  updating: boolean;
  onChangeStatus: (status: OrderStatus) => void;
  onCancel: () => void;
  onDelete: () => void;
  onAssign: (staffId: string) => void;
}) {
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const deliveryFee = Number(order.delivery_fee ?? 0);

  return (
    <article
      id="order-print"
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Select
          label="تغيير الحالة"
          value={order.status}
          disabled={updating}
          onChange={(e) => onChangeStatus(e.target.value as OrderStatus)}
          options={statusOptions.filter((o) => o.value !== "all")}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" disabled={updating} onClick={onCancel}>
            إلغاء
          </Button>
          <Button variant="ghost" disabled={updating} onClick={onDelete}>
            حذف
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {order.order_type === "delivery" && staffList.length > 0 && (
        <div className="no-print mb-4">
          <Select
            label="تعيين موظف"
            value={order.assigned_to ?? ""}
            disabled={updating}
            onChange={(e) => onAssign(e.target.value)}
            options={[
              { value: "", label: "بدون تعيين" },
              ...staffList.map((s) => ({
                value: s.user_id,
                label: s.full_name,
              })),
            ]}
          />
        </div>
      )}

      <header className="border-b border-stone-200 pb-3">
        <h2 className="text-xl font-bold" dir="ltr">
          {order.order_number}
        </h2>
        <p className="text-sm text-stone-500">
          {order.branches?.name} · {formatDateTimeAr(order.created_at)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {order.staff?.full_name && (
            <span className="text-xs text-stone-500">
              الموظف: {order.staff.full_name}
            </span>
          )}
        </div>
      </header>

      <section className="mt-4 space-y-1 text-sm">
        <p>
          <strong>الزبون:</strong> {order.customer_name}
        </p>
        <p>
          <strong>الهاتف:</strong>{" "}
          <span dir="ltr">{order.customer_phone}</span>
        </p>
        <p>
          <strong>النوع:</strong> {orderTypeLabels[order.order_type]}
        </p>
        {order.customer_address && (
          <p>
            <strong>العنوان:</strong> {order.customer_address}
          </p>
        )}
        {order.customer_lat != null && order.customer_lng != null && (
          <p>
            <strong>الموقع:</strong>{" "}
            <CustomerLocationActions
              lat={Number(order.customer_lat)}
              lng={Number(order.customer_lng)}
            />
          </p>
        )}
        {order.table_number && (
          <p>
            <strong>الطاولة:</strong> {order.table_number}
          </p>
        )}
        {order.general_note && (
          <p>
            <strong>ملاحظة عامة:</strong> {order.general_note}
          </p>
        )}
        {order.status === "delivered" && order.collected_amount != null && (
          <p className="text-emerald-800">
            <strong>المبلغ المحصّل:</strong>{" "}
            {formatPrice(Number(order.collected_amount))}
          </p>
        )}
        {(() => {
          const deliveryEv = events.find(
            (ev) =>
              ev.event === "delivered" &&
              ev.meta &&
              typeof ev.meta === "object" &&
              ev.meta.note
          );
          const note =
            deliveryEv && typeof deliveryEv.meta.note === "string"
              ? deliveryEv.meta.note
              : null;
          if (!note) return null;
          return (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950">
              <strong>ملاحظة التسليم:</strong> {note}
            </p>
          );
        })()}
        {order.cancel_reason && (
          <p className="text-red-700">
            <strong>سبب الإلغاء:</strong> {order.cancel_reason}
          </p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="mb-2 font-semibold">الأصناف</h3>
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {order.order_items?.map((item) => (
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
        <div className="mt-3 space-y-1 text-sm" dir="ltr">
          <p className="flex justify-between">
            <span>المجموع الفرعي</span>
            <span>{formatPrice(subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span>رسوم التوصيل</span>
            <span>{formatPrice(deliveryFee)}</span>
          </p>
          <p className="flex justify-between text-lg font-bold">
            <span>المجموع</span>
            <span>{formatPrice(Number(order.total))}</span>
          </p>
        </div>
        <p className="text-sm text-emerald-700">الدفع: نقداً عند الاستلام</p>
      </section>

      {events.length > 0 && (
        <section className="no-print mt-4">
          <h3 className="mb-2 font-semibold">الخط الزمني</h3>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-stone-600">
            {events.map((ev) => {
              const meta =
                ev.meta && typeof ev.meta === "object"
                  ? (ev.meta as Record<string, unknown>)
                  : null;
              const note = typeof meta?.note === "string" ? meta.note : null;
              const collected =
                typeof meta?.collected_amount === "number"
                  ? meta.collected_amount
                  : null;
              return (
                <li
                  key={ev.id}
                  className="border-b border-stone-100 pb-1.5 last:border-0"
                >
                  <div>
                    {formatDateTimeAr(ev.created_at)} — {ev.event}
                    {ev.to_status
                      ? ` → ${ORDER_STATUS_LABELS[ev.to_status as OrderStatus] ?? ev.to_status}`
                      : ""}
                  </div>
                  {collected != null && (
                    <div className="mt-0.5 text-emerald-700">
                      محصّل: {formatPrice(collected)}
                    </div>
                  )}
                  {note && (
                    <div className="mt-0.5 text-amber-900">ملاحظة: {note}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
