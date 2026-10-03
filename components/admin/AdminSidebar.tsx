"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  LogOut,
  Shield,
  Users,
  Wallet,
  Trash2,
  Star,
  Menu,
  X,
} from "lucide-react";
import { logoutAction } from "@/lib/admin-actions";
import { cn } from "@/lib/utils";
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

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return (
    pathname.startsWith(href) ||
    (href === "/admin/branches" && pathname.startsWith("/admin/categories"))
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    await logoutAction();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 border-b border-stone-200 bg-white md:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800"
              aria-label="فتح القائمة"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <p className="truncate text-sm font-bold text-brand-700">
              لوحة التحكم
            </p>
          </div>
          <NotificationBell role="admin" />
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(18.5rem,86vw)] flex-col bg-white shadow-2xl animate-dropdown-in">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
              <p className="text-sm font-bold text-brand-700">القائمة</p>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-auto border-t border-stone-200 p-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print hidden min-h-screen w-56 shrink-0 flex-col border-l border-stone-200 bg-white md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-4">
          <p className="text-sm font-bold text-brand-700">لوحة التحكم</p>
          <NotificationBell role="admin" />
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto p-2">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="تنقل الأدمن">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
