#!/usr/bin/env python3
"""فحص تشغيلي: يسجّل الدخول ثم يفتح كل صفحات التطبيق ويتحقق من عدم وجود أخطاء.

الاستخدام: python3 scripts/smoke.py [http://localhost:3000]
"""

from __future__ import annotations

import base64
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import ANON_KEY, EMAIL, PASSWORD, PROJECT_REF, SUPABASE_URL, require  # noqa: E402

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

PAGES = [
    ("/", "لوحة المعلومات"),
    ("/entries", "سجل القيود"),
    ("/custody", "العهد"),
    ("/debts", "المديونيات"),
    ("/creditors", "الموردون"),
    ("/banks", "البنوك"),
    ("/lists", "إدارة القوائم"),
    ("/review", "المراجعة"),
    ("/reports", "التقارير"),
]

# رسائل خطأ Next.js الحقيقية — نص 404 الافتراضي موجود في حِمل RSC لكل صفحة
# سليمة، وdigest بقيمة $undefined أمر طبيعي، فلا يصلحان كمؤشرَين على الخطأ
ERROR_MARKERS = [
    r"Application error: a (?:server|client)-side exception",
    r"Internal Server Error",
    r'digest\\?":\\?"[0-9a-f]{6}',
]


def login() -> str:
    body = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password", data=body, method="POST"
    )
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        session = json.loads(resp.read())

    # نفس الصيغة التي يكتبها @supabase/ssr في الكوكيز
    raw = base64.b64encode(json.dumps(session, separators=(",", ":")).encode()).decode()
    name = f"sb-{PROJECT_REF}-auth-token"
    chunk = 3180
    if len(raw) <= chunk:
        return f"{name}=base64-{raw}"
    value = f"base64-{raw}"
    parts = [value[i : i + chunk] for i in range(0, len(value), chunk)]
    return "; ".join(f"{name}.{i}={p}" for i, p in enumerate(parts))


def fetch(path: str, cookie: str):
    req = urllib.request.Request(f"{BASE}{path}")
    req.add_header("Cookie", cookie)
    req.add_header("Accept", "text/html")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8", "replace"), resp.url
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace"), path


def main():
    require()
    cookie = login()
    print(f"تم تسجيل الدخول كـ {EMAIL}\n")

    failures = []
    for path, expect in PAGES:
        status, html, final = fetch(path, cookie)
        redirected = "/login" in str(final)
        found = expect in html
        errors = [m for m in ERROR_MARKERS if re.search(m, html)]

        ok = status == 200 and found and not errors and not redirected
        flag = "✔" if ok else "✘"
        detail = ""
        if redirected:
            detail = "أُعيد التوجيه لتسجيل الدخول"
        elif errors:
            detail = f"خطأ في الصفحة: {errors[0]}"
        elif not found:
            detail = f"لم أجد النص المتوقع «{expect}»"
        print(f"{flag} {path:<12} {status}  {detail}")
        if not ok:
            failures.append((path, detail, html))

    # حماية المسارات بلا جلسة
    status, html, final = fetch("/entries", "")
    guarded = "/login" in str(final) or "تسجيل الدخول" in html
    print(f"{'✔' if guarded else '✘'} حماية المسارات بلا جلسة")
    if not guarded:
        failures.append(("guard", "المسار مفتوح بلا تسجيل دخول", ""))

    # تصدير الإكسل
    req = urllib.request.Request(f"{BASE}/api/export")
    req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        xlsx = data[:2] == b"PK" and len(data) > 5000
        print(f"{'✔' if xlsx else '✘'} تصدير الإكسل ({len(data):,} بايت)")
        if not xlsx:
            failures.append(("export", "الملف غير صحيح", ""))
    except urllib.error.HTTPError as exc:
        print(f"✘ تصدير الإكسل — {exc.code}")
        failures.append(("export", str(exc.code), ""))

    if failures:
        print(f"\nفشل {len(failures)} فحصًا")
        for path, detail, html in failures:
            if html:
                digest = re.findall(r"digest[^,]{0,120}", html)[:1]
                if digest:
                    print(f"  {path}: {digest[0]}")
        sys.exit(1)

    print("\nكل الفحوص نجحت ✔")


if __name__ == "__main__":
    main()
