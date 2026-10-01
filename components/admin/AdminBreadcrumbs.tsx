import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function AdminBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="مسار التنقل" className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-brand-700 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-stone-800" : "text-stone-600"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
