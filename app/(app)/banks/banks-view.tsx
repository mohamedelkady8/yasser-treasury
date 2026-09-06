"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { saveBank, saveSettings } from "@/app/actions/lists";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BankBalance, Settings } from "@/lib/database.types";
import { egp } from "@/lib/format";

type Draft = {
  id: string | null;
  name: string;
  opening_balance: string;
  is_usd: boolean;
  is_active: boolean;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  opening_balance: "0",
  is_usd: false,
  is_active: true,
};

export function BanksView({
  banks,
  settings,
}: {
  banks: BankBalance[];
  settings: Settings;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(String(settings?.usd_rate ?? ""));
  const [company, setCompany] = useState(settings?.company_name ?? "");

  const totals = banks.reduce(
    (acc, b) => ({
      opening: acc.opening + Number(b.opening_balance),
      movement: acc.movement + Number(b.net_movement),
      balance: acc.balance + Number(b.balance),
    }),
    { opening: 0, movement: 0, balance: 0 }
  );
  const usdBalance = banks
    .filter((b) => b.is_usd)
    .reduce((s, b) => s + Number(b.balance), 0);

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const result = await saveBank(draft.id, {
      name: draft.name,
      opening_balance: draft.opening_balance,
      is_usd: draft.is_usd,
      is_active: draft.is_active,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(draft.id ? "تم تحديث البنك" : "تمت إضافة البنك");
    setDraft(null);
  }

  async function submitSettings() {
    setBusy(true);
    const result = await saveSettings({ usd_rate: rate, company_name: company });
    setBusy(false);
    toast[result.ok ? "success" : "error"](
      result.ok ? "تم حفظ الإعدادات" : result.error
    );
  }

  return (
    <div className="rise space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setDraft(EMPTY)}>
          <Plus className="size-4" />
          بنك أو خزينة جديدة
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="scroll-slim overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="min-w-48">البنك / الخزينة</TableHead>
                <TableHead className="w-32 text-end">الرصيد الافتتاحي</TableHead>
                <TableHead className="w-32 text-end">الإيراد الداخل</TableHead>
                <TableHead className="w-32 text-end">المصروف الخارج</TableHead>
                <TableHead className="w-32 text-end">صافي الحركة</TableHead>
                <TableHead className="w-36 text-end">الرصيد الحالي</TableHead>
                <TableHead className="w-20 text-center">القيود</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((b) => (
                <TableRow key={b.id} className={b.is_active ? "" : "opacity-50"}>
                  <TableCell className="font-medium">
                    {b.name}
                    {b.is_usd && (
                      <Badge variant="secondary" className="ms-2 text-[10px]">
                        دولار
                      </Badge>
                    )}
                    {!b.is_active && (
                      <Badge variant="outline" className="ms-2 text-[10px]">
                        موقوف
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={b.opening_balance} currency={false} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money
                      value={b.revenue_in}
                      currency={false}
                      className="text-positive"
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money
                      value={b.expense_out}
                      currency={false}
                      className="text-negative"
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={b.net_movement} currency={false} sign />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money
                      value={b.balance}
                      currency={false}
                      sign
                      className="font-semibold"
                    />
                  </TableCell>
                  <TableCell className="num text-center text-xs text-muted-foreground">
                    {b.entry_count}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="تعديل"
                      onClick={() =>
                        setDraft({
                          id: b.id,
                          name: b.name,
                          opening_balance: String(b.opening_balance),
                          is_usd: b.is_usd,
                          is_active: b.is_active,
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/60 font-semibold">
                <TableCell>الإجمالي</TableCell>
                <TableCell className="text-end">
                  <Money value={totals.opening} currency={false} />
                </TableCell>
                <TableCell colSpan={2}></TableCell>
                <TableCell className="text-end">
                  <Money value={totals.movement} currency={false} sign />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={totals.balance} currency={false} sign />
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">إعدادات عامة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">اسم الشركة</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usd">سعر صرف الدولار</Label>
              <Input
                id="usd"
                type="number"
                step="0.0001"
                className="num"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                رصيد خزائن الدولار حاليًا {egp(usdBalance)} ج.م
                {Number(rate) > 0 &&
                  ` ≈ ${egp(usdBalance / Number(rate))} دولار`}
              </p>
            </div>
            <Button onClick={submitSettings} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">كيف يُحسب الرصيد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">الرصيد الافتتاحي</span>{" "}
              نقطة البداية من الشهر السابق.
            </p>
            <p>
              <span className="font-medium text-foreground">+ الإيراد</span> كل قيود
              الإيراد على البنك، بما فيها التحويلات الداخلية الواردة.
            </p>
            <p>
              <span className="font-medium text-foreground">− المصروف</span> كل قيود
              المصروف عدا «مصروف من العهدة» لأن المال كان قد خرج من البنك عند صرف
              العهدة.
            </p>
            <p>
              <span className="font-medium text-foreground">+ مرتجع العهد</span> ما
              يعيده الموظف إلى البنك عند التصفية.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "تعديل بنك / خزينة" : "بنك أو خزينة جديدة"}
            </DialogTitle>
            <DialogDescription>
              الرصيد الافتتاحي هو نقطة البداية ولا يُحسب إيرادًا
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank-name">الاسم</Label>
                <Input
                  id="bank-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-open">الرصيد الافتتاحي</Label>
                <Input
                  id="bank-open"
                  type="number"
                  step="0.01"
                  className="num"
                  value={draft.opening_balance}
                  onChange={(e) =>
                    setDraft({ ...draft, opening_balance: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="bank-usd">خزينة دولار</Label>
                <Switch
                  id="bank-usd"
                  checked={draft.is_usd}
                  onCheckedChange={(v) => setDraft({ ...draft, is_usd: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="bank-active">مُفعَّل</Label>
                <Switch
                  id="bank-active"
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
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
