"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, QrCode, Copy, Ban, FolderOpen } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { BranchFormModal } from "./BranchFormModal";
import { DuplicateMenuModal } from "./DuplicateMenuModal";
import { deleteBranch, upsertBranch } from "@/lib/admin-actions";
import { getBranchStatus } from "@/lib/opening-hours";
import type { Branch } from "@/types/database";

export function BranchesManager({
  branches,
  branchIdsWithOrders = [],
}: {
  branches: Branch[];
  branchIdsWithOrders?: string[];
}) {
  const router = useRouter();
  const hasOrdersSet = new Set(branchIdsWithOrders);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [formKey, setFormKey] = useState("new");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [qrBranch, setQrBranch] = useState<Branch | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  function openCreate() {
    setEditing(null);
    setFormKey(`new-${Date.now()}`);
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setFormKey(`edit-${branch.id}-${Date.now()}`);
    setFormOpen(true);
  }

  async function toggleActive(branch: Branch) {
    const result = await upsertBranch(
      {
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        phone: branch.phone,
        whatsapp_number: branch.whatsapp_number,
        map_url: branch.map_url || "",
        latitude: branch.latitude ?? null,
        longitude: branch.longitude ?? null,
        working_hours: branch.working_hours,
        opening_hours: branch.opening_hours ?? {},
        timezone: branch.timezone || "Asia/Damascus",
        ordering_mode: branch.ordering_mode || "auto",
        is_active: !branch.is_active,
        sort_order: branch.sort_order,
      },
      branch.id
    );
    if (result.error) toast.error(result.error);
    else {
      toast.success(branch.is_active ? "تم التعطيل" : "تم التفعيل");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          إضافة فرع
        </Button>
        <Button variant="outline" onClick={() => setDupOpen(true)}>
          <Copy className="h-4 w-4" />
          نسخ قائمة بين الفروع
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2 text-right font-medium">الاسم</th>
              <th className="px-3 py-2 text-right font-medium">Slug</th>
              <th className="px-3 py-2 text-right font-medium">النشر</th>
              <th className="px-3 py-2 text-right font-medium">الطلبات الآن</th>
              <th className="px-3 py-2 text-right font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => {
              const hoursStatus = getBranchStatus(branch);
              return (
              <tr key={branch.id} className="border-t border-stone-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/branches/${branch.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {branch.name}
                  </Link>
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {branch.slug}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(branch)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      branch.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-200 text-stone-600"
                    }`}
                    title="إظهار/إخفاء الفرع من الموقع"
                  >
                    {branch.is_active ? "منشور" : "مخفي"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      hoursStatus.isOpen
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                    title={hoursStatus.reason}
                  >
                    {hoursStatus.isOpen ? "مفتوح للطلبات" : "مغلق للطلبات"}
                  </span>
                  {!hoursStatus.isOpen && (
                    <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-stone-500">
                      {hoursStatus.reason}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/admin/branches/${branch.id}`}>
                      <Button size="sm" variant="outline">
                        <FolderOpen className="h-4 w-4" />
                        الأصناف
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(branch)}
                      aria-label="تعديل"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setQrBranch(branch)}
                      aria-label="QR"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    {hasOrdersSet.has(branch.id) ? (
                      branch.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleActive(branch)}
                          title="لا يمكن حذف فرع عليه طلبات سابقة. يمكنك تعطيله بدلاً من ذلك."
                        >
                          <Ban className="h-4 w-4" />
                          تعطيل الفرع
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 text-xs text-stone-500"
                          title="لا يمكن حذف فرع عليه طلبات سابقة"
                        >
                          <Trash2 className="h-3.5 w-3.5 opacity-40" />
                          عليه طلبات — معطّل
                        </span>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(branch.id)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <BranchFormModal
          key={formKey}
          formKey={formKey}
          open={formOpen}
          branch={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="حذف الفرع"
        message="هل أنت متأكد من حذف هذا الفرع؟ سيتم حذف الأصناف والوجبات المرتبطة."
        loading={deleting}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleting(true);
          const result = await deleteBranch(deleteId);
          setDeleting(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success("تم الحذف");
            setDeleteId(null);
            router.refresh();
          }
        }}
      />

      <Modal
        open={!!qrBranch}
        onClose={() => setQrBranch(null)}
        title={`رمز QR — ${qrBranch?.name ?? ""}`}
      >
        {qrBranch && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG
                id="branch-qr"
                value={`${siteUrl}/${qrBranch.slug}`}
                size={200}
                level="M"
              />
            </div>
            <p className="text-center text-sm text-stone-500" dir="ltr">
              {siteUrl}/{qrBranch.slug}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const svg = document.getElementById("branch-qr");
                if (!svg) return;
                const serializer = new XMLSerializer();
                const source = serializer.serializeToString(svg);
                const blob = new Blob([source], {
                  type: "image/svg+xml;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `qr-${qrBranch.slug}.svg`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              تحميل QR
            </Button>
          </div>
        )}
      </Modal>

      <DuplicateMenuModal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        branches={branches}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
