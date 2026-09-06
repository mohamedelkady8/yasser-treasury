"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { EntryForm } from "@/components/entry-form";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DebtIssue, EntryIssue, EntryView } from "@/lib/database.types";
import type { Lookups } from "@/lib/lookups";
import { DEBT_STATE_LABELS, KIND_LABELS, fmtDate, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ReviewView({
  issues,
  debtIssues,
  entries,
  lookups,
}: {
  issues: EntryIssue[];
  debtIssues: DebtIssue[];
  entries: EntryView[];
  lookups: Lookups;
}) {
  const [editing, setEditing] = useState<EntryView | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  // تجميع الملاحظات بحسب السبب ليعرف من أين يبدأ
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of issues)
      for (const r of issue.issues) map.set(r, (map.get(r) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const visible = reason
    ? issues.filter((i) => i.issues.includes(reason))
    : issues;

  const byId = useMemo(
    () => new Map(entries.map((e) => [e.id, e])),
    [entries]
  );

  if (issues.length === 0 && debtIssues.length === 0)
    return (
      <Card className="p-12 text-center">
        <CheckCircle2 className="mx-auto size-10 text-positive" />
        <p className="mt-3 font-medium">كل شيء سليم</p>
        <p className="mt-1 text-sm text-muted-foreground">
          لا توجد قيود ناقصة البيانات ولا مديونيات تحتاج انتباهًا
        </p>
      </Card>
    );

  return (
    <div className="space-y-6">
      {grouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              ملخص الملاحظات — {num(issues.length)} قيد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReason(null)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  reason === null
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                الكل ({num(issues.length)})
              </button>
              {grouped.map(([text, count]) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setReason(reason === text ? null : text)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    reason === text
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  {text}{" "}
                  <span className="num text-muted-foreground">({num(count)})</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {debtIssues.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              مديونيات تحتاج انتباهًا
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-48">المديونية</TableHead>
                  <TableHead className="w-32 text-end">المتبقي</TableHead>
                  <TableHead className="w-24">الاستحقاق</TableHead>
                  <TableHead className="w-24">الحالة</TableHead>
                  <TableHead>الملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtIssues.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="block font-medium">{d.creditor_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={d.remaining} currency={false} />
                    </TableCell>
                    <TableCell className="num text-xs">{fmtDate(d.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{DEBT_STATE_LABELS[d.state]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.issues.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/debts">فتح صفحة المديونيات</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="scroll-slim overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-24">رقم القيد</TableHead>
                  <TableHead className="w-20">النوع</TableHead>
                  <TableHead className="w-24">التاريخ</TableHead>
                  <TableHead className="min-w-48">البيان</TableHead>
                  <TableHead className="w-32 text-end">المبلغ</TableHead>
                  <TableHead className="min-w-56">الملاحظات</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="num text-xs text-muted-foreground">
                      {issue.entry_code}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[11px]",
                          issue.kind === "revenue"
                            ? "bg-positive/10 text-positive"
                            : "bg-negative/10 text-negative"
                        )}
                      >
                        {KIND_LABELS[issue.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-xs">
                      {fmtDate(issue.entry_date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {issue.description || (
                        <span className="text-muted-foreground">بلا بيان</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={issue.amount} currency={false} />
                    </TableCell>
                    <TableCell>
                      <ul className="space-y-0.5">
                        {issue.issues.map((r) => (
                          <li key={r} className="text-xs text-warning">
                            • {r}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="تعديل"
                        onClick={() => setEditing(byId.get(issue.id) ?? null)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        128 قيدًا من بيانات أغسطس بلا مركز تكلفة، وهذه حالة موجودة في الإكسل الأصلي.
        النظام لا يمنعها لكنه يعرضها هنا لتُستكمل تدريجيًا.
      </p>

      <EntryForm
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        lookups={lookups}
        entry={editing}
      />
    </div>
  );
}
