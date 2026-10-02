"use client";

import { useEffect, useState } from "react";
import {
  subscribeOrdersRealtime,
  type OrdersRealtimeChange,
  type OrdersRealtimeStatus,
} from "@/lib/orders-realtime";

/**
 * Hook onto the shared orders Realtime bus (one channel app-wide).
 */
export function useOrdersRealtime(handlers: {
  onChange?: (change: OrdersRealtimeChange) => void;
  onRefetchNeeded?: (reason: string) => void;
}): { status: OrdersRealtimeStatus } {
  const [status, setStatus] = useState<OrdersRealtimeStatus>("connecting");

  useEffect(() => {
    return subscribeOrdersRealtime({
      onChange: handlers.onChange,
      onStatus: setStatus,
      onRefetchNeeded: handlers.onRefetchNeeded,
    });
    // Handlers are expected to be stable via useEffectEvent / refs in callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}
