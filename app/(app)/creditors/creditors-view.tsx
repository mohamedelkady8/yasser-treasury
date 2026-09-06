"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeRow, saveCreditor } from "@/app/actions/lists";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreditorBalance } from "@/lib/database.types";

type Draft = { id: string | null; name: string; phone: string; note: string };

const EMPTY: Draft = { id: null, name: "", phone: "", note: "" };

export function CreditorsView({ creditors }: { creditors: CreditorBalance[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const totalRemaining = creditors.reduce((s, c) => s + Number(c.remaining), 0);

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const result = await saveCreditor(draft.id, {
      name: draft.name,
      phone: draft.phone || null,
      note: draft.note || null,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(draft.id ? "تم التحديث" : "تمت إضافة المورد");
    setDraft(null);
  }

  async function remove(row: CreditorBalance) {
    if (Number(row.total_debts) > 0) {
      toast.error("لا يمكن حذف مورد له مديونيات مسجَّلة");
      return;
    }
    if (!confirm(`حذف «${row.name}»؟`)) return;
    const result = await removeRow("creditors", row.id);
    toast[result.ok ? "success" : "error"](result.ok ? "تم الحذف" : result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          إجمالي المتبقي لكل الموردين:{" "}
          <Money value={totalRemaining} className="font-semibold text-negative" />
        </p>
        <Button onClick={() => setDraft(EMPTY)}>
          <Plus className="size-4" />
          مورد جديد
        </Button>
      </div>

      {creditors.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-medium">لا يوجد موردون مسجَّلون</p>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف المورد أولًا، ثم سجّل مديونيته من صفحة المديونيات
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="scroll-slim overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="min-w-48">المورد / الدائن</TableHead>
                  <TableHead className="w-32">الهاتف</TableHead>
                  <TableHead className="w-24 text-center">المديونيات</TableHead>
                  <TableHead className="w-32 text-end">الإجمالي</TableHead>
                  <TableHead className="w-32 text-end">المدفوع</TableHead>
                  <TableHead className="w-32 text-end">المتبقي</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditors.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name}
                      {c.note && (
                        <span className="block text-xs text-muted-foreground">
                          {c.note}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="num text-xs" dir="ltr">
                      {c.phone || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {Number(c.open_debts) > 0 ? (
                        <Badge variant="secondary">
                          {c.open_debts} قائمة / {c.total_debts}
                        </Badge>
                      ) : (
                        <span className="num text-xs text-muted-foreground">
                          {c.total_debts}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={c.total_amount} currency={false} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money
                        value={c.paid_amount}
                        currency={false}
                        className="text-positive"
                      />
                    </TableCell>
                    <TableCell className="text-end">
                      <Money
                        value={c.remaining}
                        currency={false}
                        className="font-semibold text-negative"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="تعديل"
                          onClick={() =>
                            setDraft({
                              id: c.id,
                              name: c.name,
                              phone: c.phone ?? "",
                              note: c.note ?? "",
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          aria-label="حذف"
                          onClick={() => remove(c)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        لتسجيل مديونية جديدة أو دفعة، انتقل إلى{" "}
        <Link href="/debts" className="text-primary underline-offset-4 hover:underline">
          صفحة المديونيات
        </Link>
        .
      </p>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "تعديل المورد" : "مورد جديد"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cr-name">الاسم</Label>
                <Input
                  id="cr-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-phone">الهاتف</Label>
                <Input
                  id="cr-phone"
                  dir="ltr"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-note">ملاحظات</Label>
                <Textarea
                  id="cr-note"
                  rows={2}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              حفظ
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
