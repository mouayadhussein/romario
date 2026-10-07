"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    pathname === "/admin/login" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/reset-password" ||
    pathname === "/admin/mfa/verify";

  if (bare) {
    return (
      <div className="min-h-screen overflow-x-clip bg-stone-100">{children}</div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-stone-50 md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1 overflow-x-clip px-3 py-4 md:p-6">
        {children}
      </div>
    </div>
  );
}
