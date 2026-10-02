"use client";

import { createClient } from "@/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type OrdersRealtimeStatus = "connecting" | "connected" | "disconnected";

export type OrderRowLite = {
  id: string;
  branch_id?: string;
  status?: string;
  assigned_to?: string | null;
  deleted_at?: string | null;
  order_type?: string;
  collected_amount?: number | null;
  [key: string]: unknown;
};

export type OrdersRealtimeChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  row: OrderRowLite;
  oldRow?: OrderRowLite | null;
};

type ChangeListener = (change: OrdersRealtimeChange) => void;
type StatusListener = (status: OrdersRealtimeStatus) => void;
type RefetchListener = (reason: string) => void;

const CHANNEL_NAME = "debbo-orders-shared";
const STALE_MS = 30_000;

class OrdersRealtimeBus {
  private client: SupabaseClient<Database> | null = null;
  private channel: RealtimeChannel | null = null;
  private authUnsub: (() => void) | null = null;
  private changeListeners = new Set<ChangeListener>();
  private statusListeners = new Set<StatusListener>();
  private refetchListeners = new Set<RefetchListener>();
  private status: OrdersRealtimeStatus = "disconnected";
  private lastEventAt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityBound = false;
  private onlineBound = false;
  private refCount = 0;

  private setStatus(next: OrdersRealtimeStatus) {
    if (this.status === next) return;
    this.status = next;
    for (const l of this.statusListeners) l(next);
    if (next === "disconnected") this.startPollFallback();
    else this.stopPollFallback();
  }

  getStatus() {
    return this.status;
  }

  private emitChange(change: OrdersRealtimeChange) {
    this.lastEventAt = Date.now();
    for (const l of this.changeListeners) {
      try {
        l(change);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private emitRefetch(reason: string) {
    for (const l of this.refetchListeners) {
      try {
        l(reason);
      } catch {
        /* ignore */
      }
    }
  }

  private startPollFallback() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.status === "connected") {
        const silent = Date.now() - this.lastEventAt;
        if (silent < STALE_MS) return;
      }
      this.emitRefetch("poll");
    }, STALE_MS);
  }

  private stopPollFallback() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private ensureClient() {
    if (!this.client) this.client = createClient();
    return this.client;
  }

  private bindWindowEvents() {
    if (typeof window === "undefined") return;
    if (!this.visibilityBound) {
      this.visibilityBound = true;
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    if (!this.onlineBound) {
      this.onlineBound = true;
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
  }

  private unbindWindowEvents() {
    if (typeof window === "undefined") return;
    if (this.visibilityBound) {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.visibilityBound = false;
    }
    if (this.onlineBound) {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
      this.onlineBound = false;
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible") {
      this.emitRefetch("visibility");
      if (this.status !== "connected") this.resubscribe();
    }
  };

  private onOnline = () => {
    this.emitRefetch("online");
    this.resubscribe();
  };

  private onOffline = () => {
    this.setStatus("disconnected");
  };

  private teardownChannel() {
    const client = this.client;
    if (client && this.channel) {
      void client.removeChannel(this.channel);
    }
    this.channel = null;
  }

  private resubscribe() {
    if (this.refCount <= 0) return;
    this.teardownChannel();
    this.attachChannel();
  }

  private attachChannel() {
    const supabase = this.ensureClient();
    this.setStatus("connecting");

    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          this.lastEventAt = Date.now();
          if (this.status !== "connected") this.setStatus("connected");

          if (payload.eventType === "DELETE") {
            const old = payload.old as OrderRowLite;
            if (old?.id) {
              this.emitChange({
                eventType: "DELETE",
                row: { id: old.id },
                oldRow: old,
              });
            }
            return;
          }

          const row = payload.new as OrderRowLite;
          if (!row?.id) return;
          this.emitChange({
            eventType: payload.eventType as "INSERT" | "UPDATE",
            row,
            oldRow: (payload.old as OrderRowLite) ?? null,
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("connected");
          this.lastEventAt = Date.now();
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          this.setStatus("disconnected");
          if (err) {
            // schedule soft resubscribe
            window.setTimeout(() => {
              if (this.refCount > 0 && this.status !== "connected") {
                this.resubscribe();
              }
            }, 2000);
          }
        }
      });

    this.channel = channel;
  }

  private ensureAuthListener() {
    if (this.authUnsub) return;
    const supabase = this.ensureClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        this.resubscribe();
      }
      if (event === "SIGNED_OUT") {
        this.teardownChannel();
        this.setStatus("disconnected");
      }
    });
    this.authUnsub = () => data.subscription.unsubscribe();
  }

  retain() {
    this.refCount += 1;
    this.bindWindowEvents();
    this.ensureAuthListener();
    if (this.refCount === 1) {
      this.attachChannel();
      this.startPollFallback();
    }
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.teardownChannel();
      this.stopPollFallback();
      this.unbindWindowEvents();
      if (this.authUnsub) {
        this.authUnsub();
        this.authUnsub = null;
      }
      this.setStatus("disconnected");
    }
  }

  onChange(listener: ChangeListener) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onRefetchNeeded(listener: RefetchListener) {
    this.refetchListeners.add(listener);
    return () => this.refetchListeners.delete(listener);
  }
}

const globalKey = "__debboOrdersRealtimeBus";

function getBus(): OrdersRealtimeBus {
  const g = globalThis as unknown as Record<string, OrdersRealtimeBus | undefined>;
  if (!g[globalKey]) g[globalKey] = new OrdersRealtimeBus();
  return g[globalKey]!;
}

/**
 * Shared Supabase Realtime subscription for `orders`.
 * Multiple React trees share one channel; call cleanup on unmount.
 */
export function subscribeOrdersRealtime(handlers: {
  onChange?: ChangeListener;
  onStatus?: StatusListener;
  onRefetchNeeded?: RefetchListener;
}): () => void {
  const bus = getBus();
  bus.retain();
  const offs: Array<() => void> = [];
  if (handlers.onChange) offs.push(bus.onChange(handlers.onChange));
  if (handlers.onStatus) offs.push(bus.onStatus(handlers.onStatus));
  if (handlers.onRefetchNeeded) {
    offs.push(bus.onRefetchNeeded(handlers.onRefetchNeeded));
  }
  return () => {
    for (const off of offs) off();
    bus.release();
  };
}

export function getOrdersRealtimeStatus(): OrdersRealtimeStatus {
  return getBus().getStatus();
}

export const OPEN_ORDER_EVENT = "debbo:open-order";

export function dispatchOpenOrder(orderId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_ORDER_EVENT, { detail: { orderId } })
  );
}

export const ORDER_FULL_SELECT =
  "*, order_items(*), branches(id, name, slug, whatsapp_number)";

export const PENDING_LIST_SELECT =
  "id, order_number, branch_id, total, status, order_type, assigned_to, deleted_at, created_at, branches(name)";

export const PENDING_DETAIL_SELECT =
  "id, order_number, branch_id, total, status, order_type, assigned_to, deleted_at, created_at, customer_name, customer_address, customer_lat, customer_lng, general_note, branches(name), order_items(id, name_snapshot, quantity, note)";
