"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Filter,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteEntry, setReconStatus } from "@/app/actions/entries";
import { Combobox } from "@/components/combobox";
import { EntryForm } from "@/components/entry-form";
import { ClearFilters, SearchInput, useFilters } from "@/components/filter-bar";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EntryView } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import { MOVEMENT_LABELS, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EntriesView({
  rows,
  lookups,
  total,
  page,
  pageSize,
  sums,
}: {
  rows: EntryView[];
  lookups: Lookups;
  total: number;
  page: number;
  pageSize: number;
  sums: { revenue: number; expense: number };
}) {
  const { get, set } = useFilters();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EntryView | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const kind = get("kind");
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: EntryView) {
    setEditing(row);
    setFormOpen(true);
  }

  async function remove(row: EntryView) {
    if (!confirm(`حذف القيد ${row.entry_code}؟ لا يمكن التراجع.`)) return;
    setDeleting(row.id);
    const result = await deleteEntry(row.id);
    setDeleting(null);
    toast[result.ok ? "success" : "error"](
      result.ok ? "تم حذف القيد" : result.error
    );
  }

  async function toggleRecon(row: EntryView) {
    const next = row.recon_status === "reconciled" ? "pending" : "reconciled";
    const result = await setReconStatus(row.id, next);
    if (!result.ok) toast.error(result.error);
  }

  const options = useMemo(
    () => ({
      banks: lookups.banks.map((b) => ({ value: b.id, label: b.name })),
      accounts: lookups.accounts.map((a) => ({ value: a.id, label: a.name })),
      ledgers: lookups.ledgers.map((l) => ({ value: l.id, label: l.name })),
      costCenters: lookups.costCenters.map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.is_custody ? "عهدة" : undefined,
      })),
    }),
    [lookups]
  );

  return (
    <div className="rise space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-muted p-1">
          {[
            { value: "", label: "الكل" },
            { value: "revenue", label: "إيرادات" },
            { value: "expense", label: "مصروفات" },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set({ kind: t.value || null })}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                kind === t.value
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <SearchInput />

        <Button
          type="button"
          variant={showFilters ? "secondary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="size-4" />
          فلاتر
        </Button>
        <ClearFilters />

        <Button type="button" onClick={openNew} className="ms-auto">
          <Plus className="size-4" />
          قيد جديد
        </Button>
      </div>

      {showFilters && (
        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="from">من تاريخ</Label>
            <Input
              id="from"
              type="date"
              value={get("from")}
              onChange={(e) => set({ from: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">إلى تاريخ</Label>
            <Input
              id="to"
              type="date"
              value={get("to")}
              onChange={(e) => set({ to: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label>البنك / الخزينة</Label>
            <Combobox
              options={options.banks}
              value={get("bank") || null}
              onChange={(v) => set({ bank: v })}
              placeholder="كل البنوك"
            />
          </div>
          <div className="space-y-2">
            <Label>نوع الحركة</Label>
            <Select
              value={get("movement") || "all"}
              onValueChange={(v) => set({ movement: v === "all" ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحركات</SelectItem>
                {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>اسم الحساب</Label>
            <Combobox
              options={options.accounts}
              value={get("account") || null}
              onChange={(v) => set({ account: v })}
              placeholder="كل الحسابات"
            />
          </div>
          <div className="space-y-2">
            <Label>الأستاذ العام</Label>
            <Combobox
              options={options.ledgers}
              value={get("ledger") || null}
              onChange={(v) => set({ ledger: v })}
              placeholder="كل الأستاذ العام"
            />
          </div>
          <div className="space-y-2">
            <Label>مركز التكلفة</Label>
            <Combobox
              options={options.costCenters}
              value={get("cost_center") || null}
              onChange={(v) => set({ cost_center: v })}
              placeholder="كل مراكز التكلفة"
            />
          </div>
          <div className="space-y-2">
            <Label>المطابقة</Label>
            <Select
              value={get("recon") || "all"}
              onValueChange={(v) => set({ recon: v === "all" ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="reconciled">تمت</SelectItem>
                <SelectItem value="pending">لم تتم</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">
          إيراد المطابق:{" "}
          <Money value={sums.revenue} className="font-semibold text-positive" />
        </span>
        <span className="text-muted-foreground">
          مصروف المطابق:{" "}
          <Money value={sums.expense} className="font-semibold text-negative" />
        </span>
        <span className="text-muted-foreground">
          الصافي:{" "}
          <Money value={sums.revenue - sums.expense} sign className="font-semibold" />
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="scroll-slim overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-24">رقم القيد</TableHead>
                <TableHead className="w-24">التاريخ</TableHead>
                <TableHead className="min-w-56">البيان</TableHead>
                <TableHead className="w-32 text-end">المبلغ</TableHead>
                <TableHead className="w-40">التصنيف</TableHead>
                <TableHead className="w-36">البنك / الخزينة</TableHead>
                <TableHead className="w-28">الحركة</TableHead>
                <TableHead className="w-16 text-center">مطابقة</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                    لا توجد قيود مطابقة
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id} className={cn(deleting === row.id && "opacity-40")}>
                  <TableCell className="num text-xs text-muted-foreground">
                    {row.entry_code}
                  </TableCell>
                  <TableCell className="num text-xs">{fmtDate(row.entry_date)}</TableCell>
                  <TableCell>
                    <p className="truncate font-medium">{row.description || "—"}</p>
                    {row.creditor_name && (
                      <p className="mt-0.5 truncate text-xs text-primary">
                        دفعة لـ {row.creditor_name} — {row.debt_description}
                      </p>
                    )}
                    {row.note && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.note}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Money
                      value={row.amount}
                      currency={false}
                      className={cn(
                        "font-semibold",
                        row.kind === "revenue" ? "text-positive" : "text-negative"
                      )}
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.kind === "revenue" ? (
                      <span>{row.revenue_type_name || "—"}</span>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="truncate">{row.cost_center_name || "بلا مركز تكلفة"}</p>
                        <p className="truncate text-muted-foreground">
                          {row.ledger_name || row.account_name || "—"}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="truncate text-xs">
                    {row.bank_name ?? (
                      <span className="text-muted-foreground">من العهدة</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.movement_type !== "operational" && (
                      <Badge variant="secondary" className="text-[11px]">
                        {MOVEMENT_LABELS[row.movement_type]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggleRecon(row)}
                          className="align-middle"
                        >
                          {row.recon_status === "reconciled" ? (
                            <CheckCircle2 className="size-4 text-positive" />
                          ) : (
                            <Circle className="size-4 text-muted-foreground/50" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.recon_status === "reconciled"
                          ? "المطابقة تمت — اضغط للتراجع"
                          : "اضغط لتأكيد المطابقة"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {row.document_url && (
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <a
                            href={row.document_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="المستند"
                          >
                            <FileText className="size-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="تعديل"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="حذف"
                        onClick={() => remove(row)}
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

      {pages > 1 && <Pagination page={page} pages={pages} />}

      <EntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lookups={lookups}
        entry={editing}
      />
    </div>
  );
}

function Pagination({ page, pages }: { page: number; pages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    return next.size ? `${pathname}?${next}` : pathname;
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
        {page > 1 ? (
          <Link href={href(page - 1)} scroll={false}>
            <ChevronRight className="size-4" />
            السابق
          </Link>
        ) : (
          <span>
            <ChevronRight className="size-4" />
            السابق
          </span>
        )}
      </Button>
      <span className="num text-sm text-muted-foreground">
        {page} / {pages}
      </span>
      <Button asChild={page < pages} variant="outline" size="sm" disabled={page >= pages}>
        {page < pages ? (
          <Link href={href(page + 1)} scroll={false}>
            التالي
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span>
            التالي
            <ChevronLeft className="size-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
