"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guards";
import { deliverOrderSchema } from "@/lib/validations";
import { calculateStaffCashBalance } from "@/lib/staff-cash";
import { createServiceClient } from "@/supabase/admin";

type ActionResult = { error?: string; success?: boolean };

export async function staffClaimOrder(orderId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("claim_order", { p_order_id: orderId });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("already claimed") || msg.includes("not ready")) {
      return {
        error: "تم استلام هذا الطلب من موظف آخر أو لم يعد جاهزاً.",
      };
    }
    if (msg.includes("not authorized") || msg.includes("branch")) {
      return { error: "غير مصرح لك باستلام هذا الطلب." };
    }
    return { error: "تعذّر استلام الطلب. حدّث القائمة ثم أعد المحاولة." };
  }
  revalidatePath("/staff");
  return { success: true };
}

export async function staffReleaseOrder(orderId: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("release_order", { p_order_id: orderId });
  if (error) {
    return { error: "تعذّر التراجع عن الاستلام. تحقق أن الطلب ما زال عندك." };
  }
  revalidatePath("/staff");
  return { success: true };
}

export async function staffDeliverOrder(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const parsed = deliverOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const { error } = await supabase.rpc("deliver_order", {
    p_order_id: parsed.data.orderId,
    p_collected_amount: parsed.data.collectedAmount,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    if (error.message?.includes("note required")) {
      return { error: "أضف ملاحظة عند اختلاف المبلغ المحصّل عن الإجمالي." };
    }
    return { error: "تعذّر تأكيد التوصيل. تحقق من حالة الطلب." };
  }

  revalidatePath("/staff");
  return { success: true };
}

export async function getStaffCashBalanceAction(): Promise<{
  error?: string;
  balance?: number;
}> {
  const { userId } = await requireStaff();
  const admin = createServiceClient();

  const { data: collected } = await admin
    .from("orders")
    .select("collected_amount")
    .eq("assigned_to", userId)
    .eq("status", "delivered")
    .is("deleted_at", null)
    .not("collected_amount", "is", null);

  const { data: settlements } = await admin
    .from("cash_settlements")
    .select("amount")
    .eq("staff_id", userId);

  return {
    balance: calculateStaffCashBalance({
      collectedAmounts: (collected ?? []).map((r) => Number(r.collected_amount)),
      settlementAmounts: (settlements ?? []).map((r) => Number(r.amount)),
    }),
  };
}
