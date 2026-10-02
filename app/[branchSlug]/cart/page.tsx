import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/supabase/server";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CartCheckout } from "@/components/site/CartCheckout";
import type { Branch } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "السلة",
};

export default async function CartPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = await params;
  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select(
      "id, name, slug, address, phone, whatsapp_number, map_url, latitude, longitude, working_hours, opening_hours, timezone, ordering_mode, is_active, sort_order"
    )
    .eq("slug", branchSlug)
    .eq("is_active", true)
    .single();

  if (!branch) notFound();
  const typedBranch = branch as Branch;

  return (
    <CartProvider branchSlug={branchSlug}>
      <SiteHeader
        branchName={typedBranch.name}
        branchSlug={branchSlug}
        showBack
        showCart
      />
      <main className="mx-auto max-w-3xl px-4 py-4 pb-20">
        <CartCheckout branch={typedBranch} />
      </main>
    </CartProvider>
  );
}
