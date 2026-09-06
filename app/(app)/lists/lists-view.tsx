"use client";

import { useMemo, useState } from "react";
import { Check, HandCoins, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createSimple,
  removeRow,
  renameSimple,
  saveCostCenter,
  toggleActive,
  type SimpleTable,
} from "@/app/actions/lists";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Account, CostCenter, Ledger, RevenueType } from "@/lib/database.types";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

type Usage = Record<string, Record<string, number>>;

export function ListsView({
  accounts,
  ledgers,
  costCenters,
  revenueTypes,
  usage,
}: {
  accounts: Account[];
  ledgers: Ledger[];
  costCenters: CostCenter[];
  revenueTypes: RevenueType[];
  usage: Usage;
}) {
  return (
    <Tabs defaultValue="cost_centers">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="cost_centers">
          مراكز التكلفة
          <Badge variant="secondary" className="ms-1.5">
            {costCenters.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="ledgers">
          الأستاذ العام
          <Badge variant="secondary" className="ms-1.5">
            {ledgers.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="accounts">
          دليل الحسابات
          <Badge variant="secondary" className="ms-1.5">
            {accounts.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="revenue_types">
          أنواع الإيراد
          <Badge variant="secondary" className="ms-1.5">
            {revenueTypes.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cost_centers">
        <CostCenterList rows={costCenters} usage={usage.cost_center} />
      </TabsContent>
      <TabsContent value="ledgers">
        <SimpleList
          table="ledgers"
          title="حساب الأستاذ العام"
          rows={ledgers}
          usage={usage.ledger}
        />
      </TabsContent>
      <TabsContent value="accounts">
        <SimpleList
          table="accounts"
          title="حساب"
          rows={accounts}
          usage={usage.account}
        />
      </TabsContent>
      <TabsContent value="revenue_types">
        <SimpleList
          table="revenue_types"
          title="نوع إيراد"
          rows={revenueTypes}
          usage={usage.revenue_type}
        />
      </TabsContent>
    </Tabs>
  );
}

function useSearch<T extends { name: string }>(rows: T[]) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? rows.filter((r) => r.name.includes(q)) : rows;
  }, [rows, query]);
  return { query, setQuery, filtered };
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ابحث بالاسم…"
        className="ps-9"
      />
    </div>
  );
}

function SimpleList({
  table,
  title,
  rows,
  usage,
}: {
  table: SimpleTable;
  title: string;
  rows: (Account | Ledger | RevenueType)[];
  usage: Record<string, number>;
}) {
  const { query, setQuery, filtered } = useSearch(rows);
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!adding.trim()) return;
    setBusy(true);
    const result = await createSimple(table, adding);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`تمت إضافة ${title}`);
    setAdding("");
  }

  async function rename() {
    if (!editing) return;
    setBusy(true);
    const result = await renameSimple(table, editing.id, editing.name);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("تم التعديل");
    setEditing(null);
  }

  async function remove(row: { id: string; name: string }) {
    const used = usage[row.id] ?? 0;
    if (used > 0) {
      toast.error(`مستخدم في ${used} قيد — أوقف التفعيل بدلًا من الحذف`);
      return;
    }
    if (!confirm(`حذف «${row.name}»؟`)) return;
    const result = await removeRow(table, row.id);
    toast[result.ok ? "success" : "error"](result.ok ? "تم الحذف" : result.error);
  }

  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} />
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`${title} جديد…`}
          className="min-w-48 flex-1"
        />
        <Button onClick={add} disabled={busy || !adding.trim()}>
          <Plus className="size-4" />
          إضافة
        </Button>
      </div>

      <Card className="p-2">
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const used = usage[row.id] ?? 0;
            return (
              <div
                key={row.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/60",
                  !row.is_active && "opacity-50"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                {used > 0 && (
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {num(used)}
                  </span>
                )}
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="تعديل"
                    onClick={() => setEditing({ id: row.id, name: row.name })}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={row.is_active ? "إيقاف" : "تفعيل"}
                    onClick={() => toggleActive(table, row.id, !row.is_active)}
                  >
                    {row.is_active ? (
                      <X className="size-3" />
                    ) : (
                      <Check className="size-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    aria-label="حذف"
                    onClick={() => remove(row)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            لا يوجد نتائج
          </p>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        الرقم بجانب الاسم هو عدد القيود المستخدِمة له. البند المستخدم لا يُحذف؛ أوقف
        تفعيله فيختفي من قوائم الإدخال ويبقى في التقارير القديمة.
      </p>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل الاسم</DialogTitle>
            <DialogDescription>
              التعديل يسري على كل القيود المرتبطة تلقائيًا
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && rename()}
            />
          )}
          <DialogFooter>
            <Button onClick={rename} disabled={busy}>
              حفظ
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CcDraft = {
  id: string | null;
  name: string;
  custody_opening: string;
  custody_holder: string;
  is_active: boolean;
};

function CostCenterList({
  rows,
  usage,
}: {
  rows: CostCenter[];
  usage: Record<string, number>;
}) {
  const { query, setQuery, filtered } = useSearch(rows);
  const [draft, setDraft] = useState<CcDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyCustody, setOnlyCustody] = useState(false);

  const visible = onlyCustody ? filtered.filter((r) => r.is_custody) : filtered;
  const custodyCount = rows.filter((r) => r.is_custody).length;

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const result = await saveCostCenter(draft.id, {
      name: draft.name,
      custody_opening: draft.custody_opening,
      custody_holder: draft.custody_holder || null,
      is_active: draft.is_active,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(draft.id ? "تم التحديث" : "تمت الإضافة");
    setDraft(null);
  }

  async function remove(row: CostCenter) {
    const used = usage[row.id] ?? 0;
    if (used > 0) {
      toast.error(`مستخدم في ${used} قيد — أوقف التفعيل بدلًا من الحذف`);
      return;
    }
    if (!confirm(`حذف «${row.name}»؟`)) return;
    const result = await removeRow("cost_centers", row.id);
    toast[result.ok ? "success" : "error"](result.ok ? "تم الحذف" : result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} />
        <Button
          variant={onlyCustody ? "secondary" : "outline"}
          onClick={() => setOnlyCustody((v) => !v)}
        >
          <HandCoins className="size-4" />
          العهد فقط ({custodyCount})
        </Button>
        <Button
          onClick={() =>
            setDraft({
              id: null,
              name: "",
              custody_opening: "0",
              custody_holder: "",
              is_active: true,
            })
          }
        >
          <Plus className="size-4" />
          مركز تكلفة جديد
        </Button>
      </div>

      <Card className="p-2">
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => {
            const used = usage[row.id] ?? 0;
            return (
              <div
                key={row.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/60",
                  !row.is_active && "opacity-50"
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {row.name}
                  {row.is_custody && (
                    <Badge variant="secondary" className="ms-1.5 text-[10px]">
                      عهدة
                    </Badge>
                  )}
                  {row.is_custody && Number(row.custody_opening) !== 0 && (
                    <span className="block text-[11px] text-muted-foreground">
                      افتتاحي <Money value={row.custody_opening} currency={false} />
                    </span>
                  )}
                </span>
                {used > 0 && (
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {num(used)}
                  </span>
                )}
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="تعديل"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        name: row.name,
                        custody_opening: String(row.custody_opening),
                        custody_holder: row.custody_holder ?? "",
                        is_active: row.is_active,
                      })
                    }
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    aria-label="حذف"
                    onClick={() => remove(row)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">لا يوجد نتائج</p>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        أي مركز تكلفة يبدأ اسمه بكلمة «عهد» يصبح عهدة تلقائيًا، فيظهر في صفحة العهد
        برصيد مستقل ويُحسب ضمن النقدية حتى تُصفَّى.
      </p>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "تعديل مركز التكلفة" : "مركز تكلفة جديد"}
            </DialogTitle>
            <DialogDescription>
              ابدأ الاسم بكلمة «عهد» لتحويله إلى عهدة — مثل «عهدة أحمد»
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cc-name">الاسم</Label>
                <Input
                  id="cc-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                {draft.name.trim().startsWith("عهد") && (
                  <p className="text-xs text-primary">
                    سيُعامل كعهدة وله رصيد مستقل في صفحة العهد
                  </p>
                )}
              </div>
              {draft.name.trim().startsWith("عهد") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cc-open">رصيد العهدة الافتتاحي</Label>
                    <Input
                      id="cc-open"
                      type="number"
                      step="0.01"
                      className="num"
                      value={draft.custody_opening}
                      onChange={(e) =>
                        setDraft({ ...draft, custody_opening: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cc-holder">صاحب العهدة</Label>
                    <Input
                      id="cc-holder"
                      value={draft.custody_holder}
                      onChange={(e) =>
                        setDraft({ ...draft, custody_holder: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="cc-active">مُفعَّل</Label>
                <Switch
                  id="cc-active"
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              حفظ
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
