"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { recordCashSettlementAction } from "@/lib/order-actions";
import { calculateStaffCashBalance } from "@/lib/staff-cash";
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
