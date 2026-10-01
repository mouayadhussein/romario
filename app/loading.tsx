import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تحميل...",
};

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
        role="status"
        aria-label="جاري التحميل"
      />
    </div>
  );
}
