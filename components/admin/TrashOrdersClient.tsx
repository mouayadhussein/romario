"use client";

import { useState } from "react";
import { toast } from "sonner";
import { hardDeleteOrder, restoreOrder } from "@/lib/order-actions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTimeAr, formatPrice } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

type TrashOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: OrderStatus;
  deleted_at: string | null;
  branches?: { name: string } | null;
};

export function TrashOrdersClient({
  initialOrders,
}: {
  initialOrders: TrashOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (orders.length === 0) {
    return <EmptyState title="سلة المحذوفات فارغة" />;
  }

  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold" dir="ltr">
                {order.order_number}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-stone-700">{order.customer_name}</p>
            <p className="text-xs text-stone-500">
              {order.branches?.name} · {formatPrice(Number(order.total))}
              {order.deleted_at
                ? ` · حُذف ${formatDateTimeAr(order.deleted_at)}`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={busyId === order.id}
              disabled={busyId != null}
              onClick={async () => {
                setBusyId(order.id);
                const result = await restoreOrder(order.id);
                setBusyId(null);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setOrders((prev) => prev.filter((o) => o.id !== order.id));
                toast.success("تم الاسترجاع");
              }}
            >
              استرجاع
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busyId === order.id}
              disabled={busyId != null}
              onClick={async () => {
                if (!confirm("حذف نهائي لا يمكن التراجع عنه؟")) return;
                setBusyId(order.id);
                const result = await hardDeleteOrder(order.id);
                setBusyId(null);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setOrders((prev) => prev.filter((o) => o.id !== order.id));
                toast.success("تم الحذف النهائي");
              }}
            >
              حذف نهائي
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
