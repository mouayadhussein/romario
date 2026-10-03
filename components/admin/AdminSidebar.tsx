"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  LogOut,
  Shield,
  Users,
  Wallet,
  Trash2,
  Star,
} from "lucide-react";
import { logoutAction } from "@/lib/admin-actions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const links = [
  { href: "/admin", label: "الطلبات", icon: LayoutDashboard },
  { href: "/admin/branches", label: "الفروع والأصناف", icon: Store },
  { href: "/admin/featured", label: "الوجبات المميزة", icon: Star },
  { href: "/admin/staff", label: "الموظفون", icon: Users },
  { href: "/admin/cash", label: "تسوية النقد", icon: Wallet },
  { href: "/admin/trash", label: "المحذوفات", icon: Trash2 },
  { href: "/admin/mfa/setup", label: "الأمان (MFA)", icon: Shield },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="no-print flex w-full flex-col border-b border-stone-200 bg-white md:w-56 md:border-b-0 md:border-l">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-4">
        <p className="text-sm font-bold text-brand-700">لوحة التحكم</p>
        <NotificationBell role="admin" />
      </div>
      <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col">
        {links.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href) ||
                (link.href === "/admin/branches" &&
                  pathname.startsWith("/admin/categories"));
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
          onClick={async () => {
            await logoutAction();
            router.push("/admin/login");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
