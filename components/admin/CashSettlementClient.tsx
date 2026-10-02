"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/supabase/client";
import { recordCashSettlementAction } from "@/lib/order-actions";
import { calculateStaffCashBalance } from "@/lib/staff-cash";
import { subscribeOrdersRealtime } from "@/lib/orders-realtime";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { formatPrice } from "@/lib/utils";

type StaffCashRow = {
  user_id: string;
  full_name: string;
  collected: number[];
  settlements: number[];
};

export function CashSettlementClient({ staff }: { staff: StaffCashRow[] }) {
  const [staffId, setStaffId] = useState(staff[0]?.user_id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [localStaff, setLocalStaff] = useState(staff);

  const refreshCollected = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("assigned_to, collected_amount")
      .in("assigned_to", userIds)
      .eq("status", "delivered")
      .not("collected_amount", "is", null);

    const byStaff = new Map<string, number[]>();
    for (const row of data ?? []) {
      if (!row.assigned_to || row.collected_amount == null) continue;
      const list = byStaff.get(row.assigned_to) ?? [];
      list.push(Number(row.collected_amount));
      byStaff.set(row.assigned_to, list);
    }

    setLocalStaff((prev) =>
      prev.map((s) => ({
        ...s,
        collected: byStaff.get(s.user_id) ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    const ids = localStaff.map((s) => s.user_id);
    return subscribeOrdersRealtime({
      onRefetchNeeded: () => {
        void refreshCollected(ids);
      },
      onChange: (change) => {
        if (change.eventType === "DELETE") return;
        const row = change.row;
        if (row.status === "delivered" && row.assigned_to) {
          void refreshCollected(ids);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCollected]);

  const selected = useMemo(
    () => localStaff.find((s) => s.user_id === staffId) ?? null,
    [localStaff, staffId]
  );

  const balance = selected
    ? calculateStaffCashBalance({
        collectedAmounts: selected.collected,
        settlementAmounts: selected.settlements,
      })
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!staffId || !Number.isFinite(value) || value <= 0) {
      toast.error("أدخل مبلغاً صالحاً");
      return;
    }
    setLoading(true);
    const result = await recordCashSettlementAction({
      staffId,
      amount: value,
      note: note || null,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setLocalStaff((prev) =>
      prev.map((s) =>
        s.user_id === staffId
          ? { ...s, settlements: [...s.settlements, value] }
          : s
      )
    );
    setAmount("");
    setNote("");
    toast.success("تم تسجيل التسوية");
  }

  if (localStaff.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        لا يوجد موظفون لتسوية النقد.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <Select
        label="الموظف"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        options={localStaff.map((s) => ({
          value: s.user_id,
          label: s.full_name,
        }))}
      />
      <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
        الرصيد المستحق:{" "}
        <strong className="text-brand-700">{formatPrice(balance)}</strong>
      </p>
      <Input
        label="مبلغ التسوية"
        type="number"
        dir="ltr"
        min={0}
        step="0.01"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Textarea
        label="ملاحظة"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" loading={loading} className="w-full">
        تسجيل التسوية
      </Button>
    </form>
  );
}
