/** Shared rules for delivery-staff deletion (no DB access). */

export const STAFF_HAS_RECORDS_MSG =
  "لا يمكن حذف موظف له سجل. يمكنك تعطيله بدلاً من ذلك";

export type StaffRecordCounts = {
  assignedOrderCount: number;
  settlementCount: number;
};

export function staffHasRecords(counts: StaffRecordCounts): boolean {
  return counts.assignedOrderCount > 0 || counts.settlementCount > 0;
}

export function canHardDeleteStaff(counts: StaffRecordCounts): boolean {
  return !staffHasRecords(counts);
}
