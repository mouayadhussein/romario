import type { OrderStatus } from "@/types/database";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const styles: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-900",
  preparing: "bg-blue-100 text-blue-900",
  ready: "bg-indigo-100 text-indigo-900",
  on_the_way: "bg-violet-100 text-violet-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-stone-200 text-stone-600",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status] ?? "bg-stone-100 text-stone-700"
      )}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
