"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import {
  updateOrderStatus,
  softDeleteOrder,
  cancelOrderAction,
  markOrderReady,
  assignOrderStaff,
} from "@/lib/order-actions";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "./StatusBadge";
import { formatDateTimeAr, formatPrice } from "@/lib/utils";
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
  const [eventsMap] = useState(eventsByOrder);
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOrders[0]?.id ?? null
  );
  const [updating, setUpdating] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] =
    useState<CancelReasonCode>("customer_cancelled");
  const [cancelText, setCancelText] = useState("");
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAlert = useCallback(() => {
    try {
      if (!audioRef.current) {
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
              .select(
                "*, order_items(*), branches(id, name, slug, whatsapp_number)"
              )
              .eq("id", newRow.id)
              .is("deleted_at", null)
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
            if (updated.deleted_at) {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
              return;
            }
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? { ...o, ...updated, order_items: o.order_items }
                  : o
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
      if (o.deleted_at) return false;
      if (branchFilter !== "all" && o.branch_id !== branchFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, branchFilter, statusFilter]);

  const selected =
    filtered.find((o) => o.id === selectedId) ?? filtered[0] ?? null;
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
    if (!confirm("نقل الطلب إلى سلة المحذوفات؟")) return;
    setUpdating(true);
    const result = await softDeleteOrder(selected.id);
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== selected.id));
    toast.success("تم الحذف");
  }

  async function handleMarkReady() {
    if (!selected) return;
    setUpdating(true);
    const result = await markOrderReady(selected.id);
    setUpdating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selected.id ? { ...o, status: "ready" as const } : o
      )
    );
    toast.success("الطلب جاهز للتوصيل");
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
              status: staffId ? ("on_the_way" as const) : o.status === "on_the_way" ? ("ready" as const) : o.status,
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

  const subtotal = Number(selected?.subtotal ?? selected?.total ?? 0);
  const deliveryFee = Number(selected?.delivery_fee ?? 0);

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
                  <p className="mt-1 text-sm text-stone-700">
                    {order.customer_name}
                  </p>
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
                  onChange={(e) =>
                    void changeStatus(e.target.value as OrderStatus)
                  }
                  options={statusOptions.filter((o) => o.value !== "all")}
                />
                <div className="flex flex-wrap items-end gap-2">
                  {(selected.status === "new" ||
                    selected.status === "preparing") && (
                    <Button
                      variant="outline"
                      disabled={updating}
                      onClick={() => void handleMarkReady()}
                    >
                      جاهز للتوصيل
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={updating}
                    onClick={() => setCancelOpen(true)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={updating}
                    onClick={() => void handleSoftDelete()}
                  >
                    حذف
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    طباعة
                  </Button>
                </div>
              </div>

              {selected.order_type === "delivery" && staffList.length > 0 && (
                <div className="no-print mb-4">
                  <Select
                    label="تعيين موظف"
                    value={selected.assigned_to ?? ""}
                    disabled={updating}
                    onChange={(e) => void handleAssign(e.target.value)}
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
                  {selected.order_number}
                </h2>
                <p className="text-sm text-stone-500">
                  {selected.branches?.name} ·{" "}
                  {formatDateTimeAr(selected.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.staff?.full_name && (
                    <span className="text-xs text-stone-500">
                      الموظف: {selected.staff.full_name}
                    </span>
                  )}
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
                  <strong>النوع:</strong>{" "}
                  {orderTypeLabels[selected.order_type]}
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
                {selected.cancel_reason && (
                  <p className="text-red-700">
                    <strong>سبب الإلغاء:</strong> {selected.cancel_reason}
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
                          {formatPrice(
                            Number(item.price_snapshot) * item.quantity
                          )}
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
                    <span>{formatPrice(Number(selected.total))}</span>
                  </p>
                </div>
                <p className="text-sm text-emerald-700">
                  الدفع: نقداً عند الاستلام
                </p>
              </section>

              {selectedEvents.length > 0 && (
                <section className="no-print mt-4">
                  <h3 className="mb-2 font-semibold">الخط الزمني</h3>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-stone-600">
                    {selectedEvents.map((ev) => (
                      <li key={ev.id}>
                        {formatDateTimeAr(ev.created_at)} — {ev.event}
                        {ev.to_status
                          ? ` → ${ORDER_STATUS_LABELS[ev.to_status as OrderStatus] ?? ev.to_status}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          )}
        </div>
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
