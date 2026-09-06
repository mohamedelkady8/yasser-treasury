"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** يقرأ ويكتب الفلاتر في عنوان الصفحة حتى تكون قابلة للمشاركة والرجوع */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (resetPage) next.delete("page");
      router.replace(next.size ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router]
  );

  const get = useCallback((key: string) => params.get(key) ?? "", [params]);

  const clear = useCallback(() => router.replace(pathname), [pathname, router]);

  const activeCount = Array.from(params.keys()).filter((k) => k !== "page").length;

  return { get, set, clear, activeCount };
}

export function SearchInput({
  placeholder = "ابحث في البيان أو رقم القيد…",
}: {
  placeholder?: string;
}) {
  const { get, set } = useFilters();
  const urlValue = get("q");
  const [value, setValue] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);

  // لو تغيّر العنوان من خارج الحقل (مسح الفلاتر أو زر الرجوع) نُزامن الحقل معه
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return;
    const id = setTimeout(() => set({ q: value || null }), 350);
    return () => clearTimeout(id);
  }, [value, urlValue, set]);

  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="ps-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="مسح البحث"
          className="absolute inset-y-0 end-1 my-auto size-7"
          onClick={() => setValue("")}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function ClearFilters() {
  const { clear, activeCount } = useFilters();
  if (!activeCount) return null;
  return (
    <Button type="button" variant="ghost" onClick={clear}>
      <X className="size-4" />
      مسح الفلاتر ({activeCount})
    </Button>
  );
}
