"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/supabase/admin";
import {
  cancelOrderSchema,
  cashSettlementSchema,
  orderStatusSchema,
  staffUpsertSchema,
} from "@/lib/validations";
import { requireAdmin, insertOrderEvent, generateTempPassword } from "@/lib/auth-guards";
import {
  canAdminTransition,
  cancelReasonLabel,
} from "@/lib/order-status";
import { calculateStaffCashBalance } from "@/lib/staff-cash";
import {
  STAFF_HAS_RECORDS_MSG,
  canHardDeleteStaff,
  type StaffRecordCounts,
} from "@/lib/staff-guards";
import { logger } from "@/lib/logger";
import type { OrderStatus } from "@/types/database";

type ActionResult = {
  error?: string;
  success?: boolean;
  tempPassword?: string;
  userId?: string;
  /** Soft-delete of delivered order with cash collected */
  cashWarning?: boolean;
  collectedAmount?: number;
};

async function getOrderOrThrow(orderId: string, includeDeleted = false) {
  const admin = createServiceClient();
  let q = admin.from("orders").select("*").eq("id", orderId);
  if (!includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return { error: "الطلب غير موجود" as const, order: null };
  return { error: null, order: data };
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "حالة غير صالحة" };

  const { error, order } = await getOrderOrThrow(orderId);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };

  const from = order.status as OrderStatus;
  const to = parsed.data;
  if (!canAdminTransition(from, to)) {
    return { error: "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية" };
  }

  if (to === "cancelled") {
    return { error: "استخدم إجراء الإلغاء مع سبب" };
  }

  const admin = createServiceClient();
  const patch: {
    status: OrderStatus;
    delivered_at?: string;
  } = { status: to };
  if (to === "on_the_way" && !order.assigned_to) {
    return { error: "عيّن موظفاً أو اترك الطلب جاهزاً ليستلمه موظف" };
  }
  if (to === "delivered") {
    patch.delivered_at = new Date().toISOString();
  }

  const { error: upErr } = await admin.from("orders").update(patch).eq("id", orderId);
  if (upErr) return { error: "فشل تحديث الحالة" };

  await insertOrderEvent({
    orderId,
    actorId: userId,
    actorRole: "admin",
    event: "status_changed",
    fromStatus: from,
    toStatus: to,
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function cancelOrderAction(input: unknown): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const { error, order } = await getOrderOrThrow(parsed.data.orderId);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };
  if (order.status === "cancelled") return { error: "الطلب ملغى مسبقاً" };
  if (order.status === "delivered") return { error: "لا يمكن إلغاء طلب مُسلَّم" };

  const reason = cancelReasonLabel(
    parsed.data.reasonCode,
    parsed.data.reasonText
  );

  const admin = createServiceClient();
  const { error: upErr } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: reason.slice(0, 200),
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      assigned_to: null,
      claimed_at: null,
    })
    .eq("id", parsed.data.orderId);

  if (upErr) return { error: "فشل إلغاء الطلب" };

  await insertOrderEvent({
    orderId: parsed.data.orderId,
    actorId: userId,
    actorRole: "admin",
    event: "cancelled",
    fromStatus: order.status,
    toStatus: "cancelled",
    meta: { reasonCode: parsed.data.reasonCode, reason },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function softDeleteOrder(orderId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const { error, order } = await getOrderOrThrow(orderId);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };

  const collected =
    order.collected_amount != null ? Number(order.collected_amount) : null;
  const hasCashOnDelivered =
    order.status === "delivered" &&
    collected != null &&
    Number.isFinite(collected) &&
    collected > 0;

  const admin = createServiceClient();
  const { error: upErr } = await admin
    .from("orders")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", orderId);
  if (upErr) return { error: "فشل حذف الطلب" };

  await insertOrderEvent({
    orderId,
    actorId: userId,
    actorRole: "admin",
    event: "soft_deleted",
    fromStatus: order.status,
    toStatus: order.status,
    meta: hasCashOnDelivered
      ? {
          warning: "delivered_with_collected_amount",
          collected_amount: collected,
          note: "طلب موصّل عليه مبلغ محصّل نُقل إلى سلة المحذوفات — يبقى في حساب رصيد الموظف",
        }
      : {},
  });

  revalidatePath("/admin");
  revalidatePath("/admin/trash");
  revalidatePath("/admin/cash");
  return {
    success: true,
    cashWarning: hasCashOnDelivered,
    collectedAmount: hasCashOnDelivered ? collected! : undefined,
  };
}

export async function restoreOrder(orderId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const { error, order } = await getOrderOrThrow(orderId, true);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };
  if (!order.deleted_at) return { error: "الطلب غير محذوف" };

  const admin = createServiceClient();
  const { error: upErr } = await admin
    .from("orders")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", orderId);
  if (upErr) return { error: "فشل الاسترجاع" };

  await insertOrderEvent({
    orderId,
    actorId: userId,
    actorRole: "admin",
    event: "restored",
    fromStatus: order.status,
    toStatus: order.status,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/trash");
  return { success: true };
}

export async function hardDeleteOrder(orderId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const { error, order } = await getOrderOrThrow(orderId, true);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };
  if (!order.deleted_at) {
    return { error: "انقل الطلب إلى سلة المحذوفات أولاً" };
  }

  const admin = createServiceClient();
  const { error: delErr } = await admin.from("orders").delete().eq("id", orderId);
  if (delErr) return { error: "فشل الحذف النهائي" };

  logger.info("orders.hard_deleted", {
    orderIdPrefix: orderId.slice(0, 8),
    by: userId.slice(0, 8),
  });

  revalidatePath("/admin/trash");
  return { success: true };
}

export async function assignOrderStaff(
  orderId: string,
  staffId: string | null
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const { error, order } = await getOrderOrThrow(orderId);
  if (error || !order) return { error: error ?? "الطلب غير موجود" };
  if (order.order_type !== "delivery") {
    return { error: "التعيين متاح لطلبات التوصيل فقط" };
  }

  const admin = createServiceClient();
  if (staffId) {
    const { data: staff } = await admin
      .from("staff")
      .select("user_id, is_active")
      .eq("user_id", staffId)
      .maybeSingle();
    if (!staff?.is_active) return { error: "الموظف غير فعّال" };

    const { data: link } = await admin
      .from("staff_branches")
      .select("staff_id")
      .eq("staff_id", staffId)
      .eq("branch_id", order.branch_id)
      .maybeSingle();
    if (!link) return { error: "الموظف غير مرتبط بفرع هذا الطلب" };
  }

  const patch =
    staffId == null
      ? {
          assigned_to: null,
          claimed_at: null,
          status: order.status === "on_the_way" ? "ready" : order.status,
        }
      : {
          assigned_to: staffId,
          claimed_at: new Date().toISOString(),
          status: "on_the_way",
        };

  const { error: upErr } = await admin.from("orders").update(patch).eq("id", orderId);
  if (upErr) return { error: "فشل تحديث الإسناد" };

  await insertOrderEvent({
    orderId,
    actorId: userId,
    actorRole: "admin",
    event: staffId ? "assigned" : "unassigned",
    fromStatus: order.status,
    toStatus: String(patch.status),
    meta: { staffId },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function createStaffAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = staffUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createServiceClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: authErr } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "staff", full_name: parsed.data.full_name },
    });

  if (authErr || !created.user) {
    logger.error("staff.create_auth_failed", {
      code: authErr?.status ?? "unknown",
    });
    return { error: "فشل إنشاء حساب الموظف (تحقق أن الإيميل غير مستخدم)" };
  }

  const userId = created.user.id;
  const { error: staffErr } = await admin.from("staff").insert({
    user_id: userId,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    is_active: parsed.data.is_active ?? true,
  });

  if (staffErr) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "فشل حفظ بيانات الموظف" };
  }

  const rows = parsed.data.branch_ids.map((branch_id) => ({
    staff_id: userId,
    branch_id,
  }));
  const { error: brErr } = await admin.from("staff_branches").insert(rows);
  if (brErr) {
    await admin.from("staff").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { error: "فشل ربط الفروع" };
  }

  revalidatePath("/admin/staff");
  return { success: true, tempPassword, userId };
}

export async function updateStaffAction(
  userId: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = staffUpsertSchema
    .omit({ email: true })
    .extend({
      email: staffUpsertSchema.shape.email.optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from("staff")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      is_active: parsed.data.is_active ?? true,
    })
    .eq("user_id", userId);
  if (error) return { error: "فشل تحديث الموظف" };

  await admin.from("staff_branches").delete().eq("staff_id", userId);
  const rows = parsed.data.branch_ids.map((branch_id) => ({
    staff_id: userId,
    branch_id,
  }));
  const { error: brErr } = await admin.from("staff_branches").insert(rows);
  if (brErr) return { error: "فشل تحديث الفروع" };

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function setStaffActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createServiceClient();
  const { error } = await admin
    .from("staff")
    .update({ is_active: isActive })
    .eq("user_id", userId);
  if (error) return { error: "فشل تحديث الحالة" };
  // Inactive staff are signed out on next request via middleware / requireStaff
  revalidatePath("/admin/staff");
  return { success: true };
}

export async function resetStaffPassword(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createServiceClient();
  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) return { error: "فشل إعادة تعيين كلمة السر" };
  return { success: true, tempPassword };
}

export async function getStaffRecordCounts(
  userId: string
): Promise<StaffRecordCounts> {
  const admin = createServiceClient();
  const [{ count: orderCount }, { count: settlementCount }] = await Promise.all([
    admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", userId),
    admin
      .from("cash_settlements")
      .select("*", { count: "exact", head: true })
      .eq("staff_id", userId),
  ]);

  return {
    assignedOrderCount: orderCount ?? 0,
    settlementCount: settlementCount ?? 0,
  };
}

export async function deleteStaffAction(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createServiceClient();

  const counts = await getStaffRecordCounts(userId);
  if (!canHardDeleteStaff(counts)) {
    return { error: STAFF_HAS_RECORDS_MSG };
  }

  try {
    const { error: brErr } = await admin
      .from("staff_branches")
      .delete()
      .eq("staff_id", userId);
    if (brErr) {
      if (brErr.code === "23503") return { error: STAFF_HAS_RECORDS_MSG };
      return { error: "فشل حذف ربط الفروع" };
    }

    const { error: staffErr } = await admin
      .from("staff")
      .delete()
      .eq("user_id", userId);
    if (staffErr) {
      if (staffErr.code === "23503") return { error: STAFF_HAS_RECORDS_MSG };
      return { error: "فشل حذف الموظف" };
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return { error: "حُذفت بيانات الموظف لكن فشل حذف حساب الدخول" };
    }
  } catch {
    return { error: STAFF_HAS_RECORDS_MSG };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function recordCashSettlementAction(
  input: unknown
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = cashSettlementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createServiceClient();
  const { data: collected } = await admin
    .from("orders")
    .select("collected_amount")
    .eq("assigned_to", parsed.data.staffId)
    .eq("status", "delivered")
    .not("collected_amount", "is", null);

  const { data: settlements } = await admin
    .from("cash_settlements")
    .select("amount")
    .eq("staff_id", parsed.data.staffId);

  const balance = calculateStaffCashBalance({
    collectedAmounts: (collected ?? []).map((r) => Number(r.collected_amount)),
    settlementAmounts: (settlements ?? []).map((r) => Number(r.amount)),
  });

  if (parsed.data.amount > balance + 0.009) {
    return {
      error: `المبلغ أكبر من الرصيد المستحق (${balance.toFixed(2)})`,
    };
  }

  const { error } = await admin.from("cash_settlements").insert({
    staff_id: parsed.data.staffId,
    amount: parsed.data.amount,
    settled_by: userId,
    note: parsed.data.note || null,
  });
  if (error) return { error: "فشل تسجيل التسوية" };

  revalidatePath("/admin/cash");
  return { success: true };
}
