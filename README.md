# نظام الإيرادات والمصروفات

تطبيق ويب يحل محل ملف `AUGUST - 26.xlsx` بالكامل: إدخال ومراجعة الإيرادات
والمصروفات، متابعة العهد وأرصدة البنوك، وتبويب للمديونيات يحسب المتاح فعليًا بعد
سداد كل الالتزامات.

- **Next.js 16** (App Router) + TypeScript + Server Actions
- **Supabase** — PostgreSQL و Auth، والمنطق المحاسبي كله في SQL views
- **Tailwind CSS v4** + shadcn/ui، خط IBM Plex Sans Arabic، واجهة عربية RTL

## التشغيل محليًا

```bash
npm install
cp .env.example .env.local   # ثم املأ القيم من لوحة Supabase
npm run dev
```

أنشئ حساب الدخول من لوحة Supabase ← Authentication ← Users
(البريد وكلمة المرور لا يُرفعان إلى GitHub).

## بنية المشروع

```
app/(app)/          الصفحات المحمية بجلسة
app/actions/        Server Actions لكل عمليات الكتابة
app/api/export/     تصدير تقرير Excel بعدة أوراق
components/         مكونات الواجهة، وentry-form.tsx هو نموذج الإدخال المشترك
lib/                عميلا Supabase، مخططات zod، دوال التنسيق
supabase/migrations/ مخطط القاعدة كاملًا بالترتيب
scripts/            الترحيل والفحص والاختبارات
```

## المنطق المحاسبي

النظام على **الأساس النقدي**: المصروف يُسجَّل لحظة خروج المال، تمامًا كما كان
الإكسل يعمل. كل الحسابات في views داخل القاعدة فلا تتكرر في الواجهة:

| View / Function | ما يحسبه |
| --- | --- |
| `v_bank_balances` | الافتتاحي + الإيراد − المصروف (باستثناء `custody_expense`) + `custody_return` |
| `v_custody_balances` | افتتاحي العهدة + `custody_out` − `custody_expense` − `custody_return` |
| `v_debt_balances` | الإجمالي، والمدفوع = مجموع القيود المرتبطة، والمتبقي وحالته |
| `v_cash_position` | البنوك + العهد = النقدية، ناقص المديونيات = **المتاح فعليًا** |
| `v_entry_issues` | محرك المراجعة: صف لكل قيد به ملاحظة مع مصفوفة الأسباب |
| `f_operational_totals` | الإيراد يستثني التحويل الداخلي، والمصروف يشمل المنفق من العهد |

### المديونيات

الدفعات ليست جدولًا منفصلًا: **كل دفعة قيد مصروف في `entries` مربوط بـ `debt_id`**.
فلو اتفقت على مليون ودفعت مئة ألف، تخرج المئة من الخزنة وتُحسب مصروفًا، وتبقى
التسعمئة التزامًا لم يمسّ الخزنة ولم يُحسب مصروفًا. لذلك «المتاح بعد السداد» لا
يتغير عند الدفع — لأن المبلغ كان محسوبًا التزامًا من أول لحظة.

### العهد

أي مركز تكلفة يبدأ اسمه بكلمة «عهد» يصبح عهدة تلقائيًا بعمود `is_custody` مُشتق.
العهدة القائمة تظهر ضمن النقدية لأنها مال الشركة وإن كان في يد موظف.

## السكربتات

```bash
python3 scripts/migrate_august.py            # ترحيل ملف أغسطس ومطابقة الإجماليات
python3 scripts/migrate_august.py --verify   # مطابقة الإجماليات فقط
python3 scripts/test_accounting.py           # اختبار المديونيات والعهد والقيود الصارمة
python3 scripts/smoke.py http://localhost:3000  # فتح كل الصفحات والتحقق منها
```

السكربتان الأولان يحتاجان `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_PASSWORD`.

## النشر

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel deploy --prod
```

## خطوة أمان متبقية

من لوحة Supabase ← **Authentication ← Sign In / Providers ← Email** أوقف
**Allow new users to sign up**. التطبيق لا يحتوي واجهة تسجيل ذاتي، وإيقاف الخيار
يغلق الباب من الخلف أيضًا. إنشاء أي حساب جديد يتم من لوحة Supabase.
