"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <div className="min-h-screen bg-stone-100">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 md:flex-row">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
