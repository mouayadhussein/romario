"use client";

import { usePathname, useRouter } from "next/navigation";
import { staffLogoutAction } from "@/lib/staff-auth";
import { config } from "@/lib/config";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const bare = pathname === "/staff/login";

  if (bare) {
    return <div className="min-h-screen bg-stone-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-brand-700">{config.appName}</p>
            <p className="text-xs text-stone-500">تطبيق التوصيل</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell role="staff" />
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
              onClick={async () => {
                await staffLogoutAction();
                router.push("/staff/login");
                router.refresh();
              }}
            >
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-3 py-4 pb-10">{children}</main>
    </div>
  );
}
