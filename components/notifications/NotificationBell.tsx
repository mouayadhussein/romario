"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import { staffClaimOrder } from "@/lib/staff-actions";
import {
  applyPendingOrderChange,
  minutesSince,
  tabTitleForPending,
  type PendingOrderSummary,
} from "@/lib/notifications/pending-orders";
import {
  ignoreOrderId,
  loadIgnoredOrderIds,
} from "@/lib/notifications/ignored-storage";
import {
  isSoundEnabled,
  isSoundMuted,
  playAlertSound,
  setSoundEnabled,
  setSoundMuted,
  vibrateShort,
} from "@/lib/notifications/sound-prefs";
import {
  dispatchOpenOrder,
  PENDING_DETAIL_SELECT,
  PENDING_LIST_SELECT,
  subscribeOrdersRealtime,
  type OrdersRealtimeStatus,
} from "@/lib/orders-realtime";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CustomerLocationActions } from "@/components/site/LocationViewModal";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Role = "staff" | "admin";

type DetailOrder = PendingOrderSummary & {
  customer_name: string;
  customer_address: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  general_note: string | null;
  order_items: Array<{
    id: string;
    name_snapshot: string;
    quantity: number;
    note: string | null;
  }>;
  branches?: { name: string } | null;
};

function toSummary(row: Record<string, unknown>): PendingOrderSummary {
  const branches = row.branches as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    order_number: String(row.order_number ?? ""),
    branch_id: String(row.branch_id ?? ""),
    branch_name: branches?.name ?? null,
    total: Number(row.total ?? 0),
    status: row.status as PendingOrderSummary["status"],
    order_type: row.order_type as PendingOrderSummary["order_type"],
    assigned_to: (row.assigned_to as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

export function NotificationBell({ role }: { role: Role }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingOrderSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DetailOrder | null>(null);
  const [claimedByOther, setClaimedByOther] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<OrdersRealtimeStatus>("connecting");
  const [soundOn, setSoundOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needGesture, setNeedGesture] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [shake, setShake] = useState(false);
  const baseTitleRef = useRef(
    typeof document !== "undefined" ? document.title : ""
  );
  const rungIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const ignoredRef = useRef<Set<string>>(new Set());
  const detailIdRef = useRef<string | null>(null);
  const branchIdsRef = useRef<string[]>([]);
  const roleRef = useRef(role);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);
  useEffect(() => {
    branchIdsRef.current = branchIds;
  }, [branchIds]);
  useEffect(() => {
    detailIdRef.current = detail?.id ?? null;
  }, [detail?.id]);

  const applyTitle = useCallback((count: number) => {
    if (typeof document === "undefined") return;
    document.title = tabTitleForPending(
      count,
      roleRef.current,
      baseTitleRef.current || document.title
    );
  }, []);

  const ringFor = useCallback(async (orderId: string) => {
    if (rungIdsRef.current.has(orderId)) return;
    rungIdsRef.current.add(orderId);
    setShake(true);
    window.setTimeout(() => setShake(false), 700);
    vibrateShort();
    const ok = await playAlertSound();
    if (!ok) setSoundBlocked(true);
  }, []);

  const fetchPending = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("orders")
      .select(PENDING_LIST_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (roleRef.current === "staff") {
      const ids = branchIdsRef.current;
      if (ids.length === 0) {
        setPending([]);
        applyTitle(0);
        return;
      }
      query = query
        .eq("status", "ready")
        .eq("order_type", "delivery")
        .is("assigned_to", null)
        .in("branch_id", ids);
    } else {
      query = query.eq("status", "new");
    }

    const { data } = await query;
    const ignored = ignoredRef.current;
    const list = ((data ?? []) as unknown as Record<string, unknown>[])
      .map(toSummary)
      .filter((o) =>
        roleRef.current === "staff" ? !ignored.has(o.id) : true
      );

    const fresh = list.filter((o) => !rungIdsRef.current.has(o.id));
    setPending(list);
    applyTitle(list.length);

    if (!primedRef.current) {
      for (const o of list) rungIdsRef.current.add(o.id);
      return;
    }

    for (const o of fresh) {
      void ringFor(o.id);
    }
  }, [applyTitle, ringFor]);

  // Bootstrap session + initial pending (no ring on first load)
  useEffect(() => {
    let cancelled = false;
    const baseTitle = baseTitleRef.current;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);
      ignoredRef.current = loadIgnoredOrderIds(user.id);

      if (role === "staff") {
        const { data: links } = await supabase
          .from("staff_branches")
          .select("branch_id")
          .eq("staff_id", user.id);
        const ids = (links ?? []).map((l) => l.branch_id);
        if (cancelled) return;
        setBranchIds(ids);
        branchIdsRef.current = ids;
      }

      try {
        setSoundOn(isSoundEnabled());
        setMuted(isSoundMuted());
        setNeedGesture(!isSoundEnabled());
      } catch {
        setNeedGesture(true);
      }

      await fetchPending();
      primedRef.current = true;
    })();
    return () => {
      cancelled = true;
      if (typeof document !== "undefined" && baseTitle) {
        document.title = baseTitle;
      }
    };
  }, [role, fetchPending]);

  useEffect(() => {
    const unsub = subscribeOrdersRealtime({
      onStatus: setStatus,
      onRefetchNeeded: () => {
        void fetchPending();
      },
      onChange: (change) => {
        if (!primedRef.current) return;
        if (change.eventType === "DELETE") {
          setPending((prev) => {
            const next = prev.filter((o) => o.id !== change.row.id);
            applyTitle(next.length);
            return next;
          });
          if (detailIdRef.current === change.row.id) {
            setClaimedByOther(true);
          }
          return;
        }

        const incoming = toSummary(change.row as Record<string, unknown>);
        setPending((prev) => {
          const withName = {
            ...incoming,
            branch_name:
              incoming.branch_name ??
              prev.find((p) => p.id === incoming.id)?.branch_name ??
              null,
          };
          const result = applyPendingOrderChange({
            role: roleRef.current,
            pending: prev,
            incoming: withName,
            branchIds: branchIdsRef.current,
            ignoredIds: ignoredRef.current,
          });
          applyTitle(result.pending.length);

          queueMicrotask(() => {
            if (result.shouldRing) void ringFor(withName.id);
            if (
              detailIdRef.current === withName.id &&
              roleRef.current === "staff" &&
              (withName.assigned_to || withName.status !== "ready")
            ) {
              setClaimedByOther(true);
            }
          });

          return result.pending;
        });
      },
    });
    return unsub;
  }, [applyTitle, fetchPending, ringFor]);

  async function openDetail(orderId: string) {
    setOpen(false);
    if (role === "admin") {
      dispatchOpenOrder(orderId);
      return;
    }
    setClaimedByOther(false);
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(PENDING_DETAIL_SELECT)
      .eq("id", orderId)
      .maybeSingle();
    if (!data) {
      toast.error("تعذّر تحميل تفاصيل الطلب");
      return;
    }
    const row = data as unknown as DetailOrder;
    if (row.assigned_to || row.status !== "ready") {
      setDetail(row);
      setClaimedByOther(true);
      return;
    }
    setDetail(row);
  }

  async function handleClaim() {
    if (!detail || claimedByOther) return;
    setClaiming(true);
    const result = await staffClaimOrder(detail.id);
    setClaiming(false);
    if (result.error) {
      toast.error(result.error);
      setClaimedByOther(true);
      return;
    }
    toast.success("تم استلام الطلب");
    setPending((prev) => {
      const next = prev.filter((o) => o.id !== detail.id);
      applyTitle(next.length);
      return next;
    });
    setDetail(null);
  }

  function handleIgnore() {
    if (!detail || !userId) return;
    ignoredRef.current = ignoreOrderId(userId, detail.id);
    setPending((prev) => {
      const next = prev.filter((o) => o.id !== detail.id);
      applyTitle(next.length);
      return next;
    });
    setDetail(null);
    toast.message("تم تجاهل الطلب من الجرس فقط");
  }

  function enableSound() {
    setSoundEnabled(true);
    setSoundMuted(false);
    setSoundOn(true);
    setMuted(false);
    setNeedGesture(false);
    setSoundBlocked(false);
    void playAlertSound().then((ok) => {
      if (!ok) {
        setSoundBlocked(true);
        toast.error("يرجى السماح بتشغيل الصوت من إعدادات المتصفح ثم أعد المحاولة");
      } else {
        toast.success("تم تفعيل التنبيهات الصوتية");
      }
    });
  }

  function toggleMute() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  }

  const count = pending.length;

  return (
    <div className="relative flex items-center gap-1">
      {status === "disconnected" && (
        <span
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
          title="إعادة الاتصال جارية"
        >
          <WifiOff className="h-3 w-3" />
          غير متصل
        </span>
      )}

      {needGesture && (
        <button
          type="button"
          onClick={enableSound}
          className="hidden rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 sm:inline-flex sm:items-center sm:gap-1"
        >
          <Volume2 className="h-3.5 w-3.5" />
          تفعيل التنبيهات الصوتية
        </button>
      )}

      {soundOn && (
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
          title={muted ? "تفعيل الصوت" : "كتم الصوت"}
          aria-label={muted ? "تفعيل الصوت" : "كتم الصوت"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          if (needGesture) {
            enableSound();
            return;
          }
          setOpen((v) => !v);
        }}
        className={cn(
          "relative rounded-lg p-2 text-stone-600 hover:bg-stone-100",
          shake && "animate-bell-shake"
        )}
        aria-label="التنبيهات"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -start-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {needGesture && (
        <button
          type="button"
          onClick={enableSound}
          className="absolute top-full start-0 z-30 mt-1 whitespace-nowrap rounded-lg border border-brand-200 bg-white px-2 py-1 text-[11px] font-semibold text-brand-800 shadow sm:hidden"
        >
          تفعيل التنبيهات الصوتية
        </button>
      )}

      {soundBlocked && (
        <p className="absolute top-full end-0 z-30 mt-1 w-48 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 shadow">
          المتصفح منع تشغيل الصوت. اضغط «تفعيل التنبيهات الصوتية».
          <button
            type="button"
            className="mt-1 block font-semibold underline"
            onClick={enableSound}
          >
            تفعيل الآن
          </button>
        </p>
      )}

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
            <div className="border-b border-stone-100 px-3 py-2 text-sm font-semibold">
              {role === "admin" ? "طلبات جديدة" : "طلبات جاهزة"}
              {count > 0 ? ` (${count})` : ""}
            </div>
            {pending.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-stone-500">
                لا توجد طلبات منتظرة
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {pending.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-start text-sm hover:bg-stone-50"
                      onClick={() => void openDetail(o.id)}
                    >
                      <span className="font-semibold" dir="ltr">
                        {o.order_number}
                      </span>
                      <span className="text-xs text-stone-500">
                        {o.branch_name ?? "فرع"} · {formatPrice(o.total)} · منذ{" "}
                        {minutesSince(o.created_at)} د
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Modal
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail ? `طلب ${detail.order_number}` : "تفاصيل الطلب"}
        footer={
          detail && role === "staff" ? (
            claimedByOther ? (
              <Button variant="secondary" onClick={() => setDetail(null)}>
                إغلاق
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleIgnore}>
                  تجاهل
                </Button>
                <Button loading={claiming} onClick={() => void handleClaim()}>
                  قبول واستلام
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-3 text-sm">
            {claimedByOther && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                تم استلام الطلب من موظف آخر
              </p>
            )}
            <p>
              <strong>الزبون:</strong> {detail.customer_name}
            </p>
            {detail.customer_address && (
              <p>
                <strong>العنوان:</strong> {detail.customer_address}
              </p>
            )}
            <p className="font-semibold text-brand-700">
              المجموع: {formatPrice(Number(detail.total))}
            </p>
            {detail.general_note && (
              <p>
                <strong>ملاحظات:</strong> {detail.general_note}
              </p>
            )}
            {detail.order_items?.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-stone-50 p-3 text-xs">
                {detail.order_items.map((item) => (
                  <li key={item.id}>
                    {item.name_snapshot} × {item.quantity}
                    {item.note ? ` — ${item.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {detail.customer_lat != null && detail.customer_lng != null && (
              <CustomerLocationActions
                lat={Number(detail.customer_lat)}
                lng={Number(detail.customer_lng)}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
