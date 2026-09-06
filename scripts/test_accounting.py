#!/usr/bin/env python3
"""اختبار المنطق المحاسبي على قاعدة البيانات الحقيقية.

يتحقق من سيناريو المديونية الذي طُلب حرفيًا (مقايسة مليون، دفعة مئة ألف)
ومن دورة العهدة كاملة، ثم ينظّف كل ما أنشأه فلا يترك أثرًا في البيانات.

الاستخدام: python3 scripts/test_accounting.py
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import ANON_KEY, EMAIL, PASSWORD, SUPABASE_URL, require  # noqa: E402

DATE = "2026-09-01"

TAG = "«اختبار آلي»"
failures: list[str] = []


class Api:
    def __init__(self):
        self.token = ANON_KEY

    def call(self, method: str, path: str, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{SUPABASE_URL}{path}", data=data, method=method)
        req.add_header("apikey", ANON_KEY)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"{method} {path} -> {exc.code}\n{exc.read().decode()}")

    def login(self):
        res = self.call(
            "POST",
            "/auth/v1/token?grant_type=password",
            {"email": EMAIL, "password": PASSWORD},
        )
        self.token = res["access_token"]

    def get(self, path: str):
        return self.call("GET", f"/rest/v1/{path}")

    def add(self, table: str, row: dict) -> dict:
        res = self.call(
            "POST",
            f"/rest/v1/{table}",
            row,
            {"Prefer": "return=representation"},
        )
        return res[0]

    def patch(self, table: str, where: str, row: dict):
        self.call("PATCH", f"/rest/v1/{table}?{where}", row)

    def drop(self, table: str, where: str):
        self.call("DELETE", f"/rest/v1/{table}?{where}")

    def rpc(self, fn: str, args: dict):
        return self.call("POST", f"/rest/v1/rpc/{fn}", args)


api = Api()


def cash() -> dict:
    row = api.get("v_cash_position?select=*")[0]
    return {k: round(float(v or 0), 2) for k, v in row.items()}


def check(label: str, actual, expected, tol=0.01):
    ok = abs(float(actual) - float(expected)) <= tol
    print(
        f"{'✔' if ok else '✘'} {label:<52}"
        f"{float(actual):>16,.2f}  (المتوقع {float(expected):>16,.2f})"
    )
    if not ok:
        failures.append(label)


def check_eq(label: str, actual, expected):
    ok = actual == expected
    print(f"{'✔' if ok else '✘'} {label:<52}{actual!r:>16}  (المتوقع {expected!r})")
    if not ok:
        failures.append(label)


def test_debt_scenario(bank_id: str, account_id: str, ledger_id: str, cc_id: str):
    print("\n=== سيناريو المديونية: مقايسة بمليون ودفعة مئة ألف ===")
    base = cash()

    creditor = api.add("creditors", {"name": f"مورد {TAG}"})

    # المقايسة تُدخل كبنود بكمية وسعر وحدة، والإجمالي يُحسب في القاعدة
    debt_id = api.rpc(
        "f_save_debt",
        {
            "p_id": None,
            "p_debt": {
                "creditor_id": creditor["id"],
                "description": f"مقايسة توريد {TAG}",
                "debt_date": DATE,
                "account_id": account_id,
                "ledger_id": ledger_id,
                "cost_center_id": cc_id,
                "status": "open",
            },
            "p_items": [
                {"name": "أسمنت", "unit": "طن", "quantity": 200, "unit_price": 2500},
                {"name": "حديد", "unit": "طن", "quantity": 100, "unit_price": 5000},
            ],
        },
    )
    debt = api.get(f"debts?id=eq.{debt_id}&select=*")[0]

    check("الإجمالي محسوب من البنود", debt["total_amount"], 1_000_000)
    items = api.get(f"debt_items?debt_id=eq.{debt_id}&select=*&order=sort_order")
    check_eq("عدد البنود المحفوظة", len(items), 2)
    check("إجمالي البند الأول = الكمية × السعر", items[0]["line_total"], 500_000)

    # أي تعديل على بند يعيد حساب إجمالي المديونية في القاعدة نفسها
    api.patch("debt_items", f"id=eq.{items[0]['id']}", {"quantity": 300})
    check(
        "تعديل كمية بند يحدّث الإجمالي",
        api.get(f"debts?id=eq.{debt_id}&select=total_amount")[0]["total_amount"],
        1_250_000,
    )
    api.patch("debt_items", f"id=eq.{items[0]['id']}", {"quantity": 200})
    check(
        "الإجمالي يعود بعودة الكمية",
        api.get(f"debts?id=eq.{debt_id}&select=total_amount")[0]["total_amount"],
        1_000_000,
    )

    after_debt = cash()
    check("النقدية لم تتغير بتسجيل المديونية", after_debt["total_cash"], base["total_cash"])
    check(
        "المديونيات المتبقية",
        after_debt["debts_outstanding"],
        base["debts_outstanding"] + 1_000_000,
    )
    check(
        "المتاح بعد السداد نقص مليونًا",
        after_debt["available_after_debts"],
        base["available_after_debts"] - 1_000_000,
    )

    # الدفعة الأولى: قيد مصروف عادي مربوط بالمديونية، بلا تصنيف ليُختبر التوريث
    payment = api.add(
        "entries",
        {
            "kind": "expense",
            "amount": 100_000,
            "description": f"دفعة أولى {TAG}",
            "entry_date": DATE,
            "bank_id": bank_id,
            "debt_id": debt["id"],
            "movement_type": "operational",
        },
    )

    # التسلسل يعتمد على قيود الشهر الفعلية، فنتحقق من الصيغة لا من الرقم
    check_eq(
        "رقم القيد تولّد تلقائيًا بصيغة الشهر",
        bool(re.fullmatch(r"SEP26-\d{4}", payment["entry_code"])),
        True,
    )
    check_eq("الدفعة ورثت اسم الحساب من المديونية", payment["account_id"], account_id)
    check_eq("الدفعة ورثت الأستاذ العام", payment["ledger_id"], ledger_id)
    check_eq("الدفعة ورثت مركز التكلفة", payment["cost_center_id"], cc_id)

    balance = api.get(f"v_debt_balances?id=eq.{debt['id']}&select=*")[0]
    check("المدفوع من المديونية", balance["paid_amount"], 100_000)
    check("المتبقي على المديونية", balance["remaining"], 900_000)
    check("نسبة السداد", balance["paid_pct"], 10)
    check_eq("حالة المديونية", balance["state"], "open")

    after_pay = cash()
    check(
        "النقدية نقصت مئة ألف فعليًا",
        after_pay["total_cash"],
        base["total_cash"] - 100_000,
    )
    check("المديونيات المتبقية", after_pay["debts_outstanding"], base["debts_outstanding"] + 900_000)
    # جوهر السيناريو: الدفع لا يغيّر «المتاح» لأن المال كان محسوبًا التزامًا أصلًا
    check(
        "المتاح بعد السداد لم يتغير بالدفع",
        after_pay["available_after_debts"],
        after_debt["available_after_debts"],
    )

    # سداد الباقي
    rest = api.add(
        "entries",
        {
            "kind": "expense",
            "amount": 900_000,
            "description": f"سداد الباقي {TAG}",
            "entry_date": DATE,
            "bank_id": bank_id,
            "debt_id": debt["id"],
            "movement_type": "operational",
        },
    )
    settled = api.get(f"v_debt_balances?id=eq.{debt['id']}&select=*")[0]
    check("المتبقي بعد السداد الكامل", settled["remaining"], 0)
    check_eq("الحالة صارت مسددة", settled["state"], "settled")

    final = cash()
    check(
        "النقدية نقصت المليون كاملًا",
        final["total_cash"],
        base["total_cash"] - 1_000_000,
    )
    check(
        "المتاح بعد السداد ثابت من أول لحظة",
        final["available_after_debts"],
        base["available_after_debts"] - 1_000_000,
    )

    return creditor["id"], debt["id"], [payment["id"], rest["id"]]


def test_custody_cycle(bank_id: str, account_id: str, ledger_id: str):
    print("\n=== دورة العهدة: صرف 50 ألفًا، إنفاق 30، رد 20 ===")
    base = cash()
    bank_before = float(
        api.get(f"v_bank_balances?id=eq.{bank_id}&select=balance")[0]["balance"]
    )
    totals_before = api.call("POST", "/rest/v1/rpc/f_operational_totals", {})[0]

    custody = api.add(
        "cost_centers",
        {"name": f"عهدة {TAG}", "custody_opening": 0, "custody_holder": "موظف تجريبي"},
    )
    check_eq("مركز يبدأ بكلمة عهد صار عهدة تلقائيًا", custody["is_custody"], True)

    common = {
        "kind": "expense",
        "entry_date": DATE,
        "cost_center_id": custody["id"],
        "account_id": account_id,
        "ledger_id": ledger_id,
    }
    out = api.add(
        "entries",
        {**common, "amount": 50_000, "movement_type": "custody_out",
         "bank_id": bank_id, "description": f"صرف عهدة {TAG}"},
    )
    spent = api.add(
        "entries",
        {**common, "amount": 30_000, "movement_type": "custody_expense",
         "bank_id": None, "description": f"مصروف من العهدة {TAG}"},
    )
    back = api.add(
        "entries",
        {**common, "amount": 20_000, "movement_type": "custody_return",
         "bank_id": bank_id, "description": f"مرتجع عهدة {TAG}"},
    )

    row = api.get(f"v_custody_balances?id=eq.{custody['id']}&select=*")[0]
    check("صُرف للعهدة", row["paid_out"], 50_000)
    check("أُنفق من العهدة", row["spent"], 30_000)
    check("رُدَّ من العهدة", row["returned"], 20_000)
    check("رصيد العهدة بعد التصفية", row["balance"], 0)
    check_eq("حالة العهدة", row["state"], "settled")

    bank_after = float(
        api.get(f"v_bank_balances?id=eq.{bank_id}&select=balance")[0]["balance"]
    )
    # البنك يخسر 50 عند الصرف ويستعيد 20 بالمرتجع، ومصروف العهدة لا يمسه
    check("رصيد البنك نقص 30 ألفًا فقط", bank_after, bank_before - 30_000)

    totals_after = api.call("POST", "/rest/v1/rpc/f_operational_totals", {})[0]
    check(
        "المصروف التشغيلي زاد بالمنفق من العهدة فقط",
        float(totals_after["expense"]),
        float(totals_before["expense"]) + 30_000,
    )
    check(
        "صرف العهدة ومرتجعها لم يُحسبا مصروفًا",
        float(totals_after["expense"]) - float(totals_before["expense"]),
        30_000,
    )

    after = cash()
    # 30 ألفًا خرجت من الشركة فعليًا، والباقي عاد للبنك
    check("إجمالي النقدية نقص 30 ألفًا", after["total_cash"], base["total_cash"] - 30_000)

    return custody["id"], [out["id"], spent["id"], back["id"]]


def test_constraints(bank_id: str, revenue_type_id: str):
    print("\n=== القيود الصارمة في القاعدة ===")
    cases = [
        (
            "منع مبلغ سالب",
            {"kind": "expense", "amount": -5, "entry_date": DATE, "bank_id": bank_id},
        ),
        (
            "منع حركة عهدة على قيد إيراد",
            {
                "kind": "revenue",
                "amount": 100,
                "entry_date": DATE,
                "bank_id": bank_id,
                "movement_type": "custody_out",
                "revenue_type_id": revenue_type_id,
            },
        ),
        (
            "منع إيراد تشغيلي بلا نوع إيراد",
            {"kind": "revenue", "amount": 100, "entry_date": DATE, "bank_id": bank_id},
        ),
        (
            "منع مركز تكلفة على قيد إيراد",
            {
                "kind": "revenue",
                "amount": 100,
                "entry_date": DATE,
                "bank_id": bank_id,
                "revenue_type_id": revenue_type_id,
                "cost_center_id": bank_id,
            },
        ),
    ]
    for label, row in cases:
        try:
            api.add("entries", row)
            print(f"✘ {label:<52}قُبل القيد ولم يُرفض")
            failures.append(label)
        except SystemExit:
            print(f"✔ {label}")


def main():
    require()
    api.login()
    print(f"تم الدخول كـ {EMAIL}")

    bank = api.get("banks?select=id,name&order=sort_order&limit=1")[0]
    account = api.get("accounts?select=id&limit=1")[0]
    ledger = api.get("ledgers?select=id&limit=1")[0]
    cc = api.get("cost_centers?select=id&is_custody=eq.false&limit=1")[0]
    revenue_type = api.get("revenue_types?select=id&limit=1")[0]

    created_entries: list[str] = []
    creditor_id = debt_id = custody_id = None

    try:
        creditor_id, debt_id, ids = test_debt_scenario(
            bank["id"], account["id"], ledger["id"], cc["id"]
        )
        created_entries += ids
        custody_id, ids = test_custody_cycle(bank["id"], account["id"], ledger["id"])
        created_entries += ids
        test_constraints(bank["id"], revenue_type["id"])
    finally:
        print("\n=== تنظيف بيانات الاختبار ===")
        for entry_id in created_entries:
            api.drop("entries", f"id=eq.{entry_id}")
        if debt_id:
            api.drop("debts", f"id=eq.{debt_id}")
        if creditor_id:
            api.drop("creditors", f"id=eq.{creditor_id}")
        if custody_id:
            api.drop("cost_centers", f"id=eq.{custody_id}")
        final = cash()
        print(f"المتاح بعد التنظيف: {final['available_after_debts']:,.2f}")
        print(f"المديونيات المتبقية: {final['debts_outstanding']:,.2f}")

    if failures:
        print(f"\nفشل {len(failures)} اختبارًا:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("\nكل الاختبارات المحاسبية نجحت ✔")


if __name__ == "__main__":
    main()
