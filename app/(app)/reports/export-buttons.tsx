"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ExportButtons({
  from,
  to,
}: {
  from: string | null;
  to: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function downloadExcel() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/export?${params}`);
      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `finance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل ملف الإكسل");
    } catch {
      toast.error("تعذّر تصدير الملف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={downloadExcel} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        تصدير Excel
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" />
        PDF / طباعة
      </Button>
    </div>
  );
}
