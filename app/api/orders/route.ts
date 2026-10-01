import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/supabase/admin";
import { createOrderSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeNote } from "@/lib/utils";
import { getBranchStatus } from "@/lib/opening-hours";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const { allowed } = checkRateLimit(`orders:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: "عدد الطلبات كبير جداً، حاول لاحقاً" },
        { status: 429 }
      );
    }

    const body: unknown = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        { error: "بيانات غير صالحة", fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = createServiceClient();

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select(
        "id, name, is_active, whatsapp_number, opening_hours, timezone, ordering_mode, working_hours"
      )
      .eq("id", data.branchId)
      .single();

    if (branchError || !branch || !branch.is_active) {
      return NextResponse.json({ error: "الفرع غير متاح" }, { status: 400 });
    }

    const status = getBranchStatus({
      opening_hours: branch.opening_hours,
      timezone: branch.timezone,
      ordering_mode: branch.ordering_mode,
      working_hours: branch.working_hours,
    });

    if (!status.isOpen) {
      return NextResponse.json(
        {
          error: `الفرع مغلق حالياً ولا يمكن استقبال الطلبات. ${status.reason}`,
        },
        { status: 409 }
      );
    }

    const itemIds = data.items.map((i) => i.itemId);
    const { data: dbItems, error: itemsError } = await supabase
      .from("items")
      .select("id, name, price, is_available, category_id, categories!inner(branch_id, is_active)")
      .in("id", itemIds);

    if (itemsError || !dbItems) {
      return NextResponse.json({ error: "فشل التحقق من الأصناف" }, { status: 500 });
    }

    type JoinedItem = {
      id: string;
      name: string;
      price: number;
      is_available: boolean;
      category_id: string;
      categories: { branch_id: string; is_active: boolean };
    };

    const itemsMap = new Map(
      (dbItems as unknown as JoinedItem[]).map((item) => [item.id, item])
    );

    const orderLines: {
      item_id: string;
      name_snapshot: string;
      price_snapshot: number;
      quantity: number;
      note: string | null;
    }[] = [];

    let total = 0;

    for (const line of data.items) {
      const dbItem = itemsMap.get(line.itemId);
      if (!dbItem) {
        return NextResponse.json(
          { error: "أحد الأصناف غير موجود" },
          { status: 400 }
        );
      }
      if (!dbItem.is_available) {
        return NextResponse.json(
          { error: `الصنف "${dbItem.name}" غير متاح حالياً` },
          { status: 400 }
        );
      }
      if (
        dbItem.categories.branch_id !== data.branchId ||
        !dbItem.categories.is_active
      ) {
        return NextResponse.json(
          { error: `الصنف "${dbItem.name}" لا ينتمي لهذا الفرع` },
          { status: 400 }
        );
      }

      const price = Number(dbItem.price);
      total += price * line.quantity;
      orderLines.push({
        item_id: dbItem.id,
        name_snapshot: dbItem.name,
        price_snapshot: price,
        quantity: line.quantity,
        note: sanitizeNote(line.note),
      });
    }

    // Atomic order number via SECURITY DEFINER RPC (service_role only)
    const { data: orderNumber, error: numError } = await supabase.rpc(
      "generate_order_number",
      { p_branch_id: data.branchId }
    );

    if (numError || !orderNumber) {
      console.error("generate_order_number error:", numError);
      return NextResponse.json(
        { error: "فشل إنشاء رقم الطلب" },
        { status: 500 }
      );
    }

    const finalOrderNumber = String(orderNumber);

    const customerLat =
      data.orderType === "delivery" && data.customerLat != null
        ? data.customerLat
        : null;
    const customerLng =
      data.orderType === "delivery" && data.customerLng != null
        ? data.customerLng
        : null;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: finalOrderNumber,
        branch_id: data.branchId,
        customer_name: data.customerName.trim(),
        customer_phone: data.customerPhone.trim(),
        customer_address: sanitizeNote(data.customerAddress, 300),
        customer_lat: customerLat,
        customer_lng: customerLng,
        order_type: data.orderType,
        table_number: sanitizeNote(data.tableNumber, 20),
        general_note: sanitizeNote(data.generalNote, 500),
        total,
        status: "new",
      })
      .select("id, order_number, total")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return NextResponse.json({ error: "فشل حفظ الطلب" }, { status: 500 });
    }

    const { error: linesError } = await supabase.from("order_items").insert(
      orderLines.map((line) => ({
        order_id: order.id,
        ...line,
      }))
    );

    if (linesError) {
      console.error("Order items insert error:", linesError);
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "فشل حفظ أصناف الطلب" }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
      orderItems: orderLines.map((l) => ({
        name: l.name_snapshot,
        quantity: l.quantity,
        price: l.price_snapshot,
        note: l.note,
      })),
    });
  } catch (err) {
    console.error("Order API error:", err);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}
