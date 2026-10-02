import { roundMoney } from "@/lib/order-fees";

export type CashLedgerInput = {
  collectedAmounts: number[];
  settlementAmounts: number[];
};

/** Balance owed by staff = sum(collected) − sum(settlements). */
export function calculateStaffCashBalance(input: CashLedgerInput): number {
  const collected = input.collectedAmounts.reduce((s, n) => s + (Number(n) || 0), 0);
  const settled = input.settlementAmounts.reduce((s, n) => s + (Number(n) || 0), 0);
  return roundMoney(collected - settled);
}
