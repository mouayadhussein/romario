import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const labels: Record<OrderStatus, string> = {
  new: "جديد",
  preparing: "قيد التحضير",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

const styles: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-900",
  preparing: "bg-blue-100 text-blue-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-stone-200 text-stone-600",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
