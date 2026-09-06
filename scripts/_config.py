"""إعدادات الاتصال المشتركة بين السكربتات.

لا تُكتب أي بيانات دخول في الكود. القيم تُقرأ من متغيرات البيئة، وللتسهيل
تُقرأ أيضًا من ملف `.env.local` وهو مستثنى من git:

    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    SUPABASE_PASSWORD=...
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env_local() -> None:
    path = ROOT / ".env.local"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env_local()


def _first(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value.strip()
    return default


SUPABASE_URL = _first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
ANON_KEY = _first("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
EMAIL = _first("SUPABASE_EMAIL", default="owner@finance.local")
PASSWORD = _first("SUPABASE_PASSWORD")
PROJECT_REF = SUPABASE_URL.split("//")[-1].split(".")[0]


def require() -> None:
    """يوقف السكربت برسالة واضحة إن كان أي متغير لازم ناقصًا."""
    missing = [
        name
        for name, value in (
            ("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
            ("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY),
            ("SUPABASE_PASSWORD", PASSWORD),
        )
        if not value
    ]
    if not missing:
        return
    raise SystemExit(
        "متغيرات ناقصة: "
        + "، ".join(missing)
        + "\nأضفها إلى finance-app/.env.local أو صدّرها في الطرفية، مثلًا:"
        + "\n  export SUPABASE_PASSWORD='…'"
    )
