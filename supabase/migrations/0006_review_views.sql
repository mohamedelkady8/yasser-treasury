-- محرك المراجعة: القيود والمديونيات التي تحتاج انتباهًا

create view v_entry_issues with (security_invoker = true) as
 WITH base AS (
         SELECT e.id,
            e.kind,
            e.entry_code,
            e.amount,
            e.description,
            e.entry_date,
            e.revenue_type_id,
            e.account_id,
            e.ledger_id,
            e.cost_center_id,
            e.bank_id,
            e.movement_type,
            e.recon_status,
            e.note,
            e.document_url,
            e.debt_id,
            e.created_at,
            e.updated_at,
            e.created_by,
            cc.is_custody AS cc_is_custody,
            cc.name AS cost_center_name,
            b.name AS bank_name,
            rt.name AS revenue_type_name,
            a.name AS account_name,
            l.name AS ledger_name,
            db.total_amount AS debt_total,
            db.paid_amount AS debt_paid,
            db.creditor_name
           FROM entries e
             LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
             LEFT JOIN banks b ON b.id = e.bank_id
             LEFT JOIN revenue_types rt ON rt.id = e.revenue_type_id
             LEFT JOIN accounts a ON a.id = e.account_id
             LEFT JOIN ledgers l ON l.id = e.ledger_id
             LEFT JOIN v_debt_balances db ON db.id = e.debt_id
        ), flagged AS (
         SELECT base.id,
            base.kind,
            base.entry_code,
            base.amount,
            base.description,
            base.entry_date,
            base.revenue_type_id,
            base.account_id,
            base.ledger_id,
            base.cost_center_id,
            base.bank_id,
            base.movement_type,
            base.recon_status,
            base.note,
            base.document_url,
            base.debt_id,
            base.created_at,
            base.updated_at,
            base.created_by,
            base.cc_is_custody,
            base.cost_center_name,
            base.bank_name,
            base.revenue_type_name,
            base.account_name,
            base.ledger_name,
            base.debt_total,
            base.debt_paid,
            base.creditor_name,
            array_remove(ARRAY[
                CASE
                    WHEN base.description IS NULL OR btrim(base.description) = ''::text THEN 'البيان فارغ'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.kind = 'expense'::entry_kind AND base.account_id IS NULL THEN 'اسم الحساب غير محدد'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.kind = 'expense'::entry_kind AND base.ledger_id IS NULL THEN 'الأستاذ العام غير محدد'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.kind = 'expense'::entry_kind AND base.cost_center_id IS NULL THEN 'مركز التكلفة غير محدد'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.kind = 'revenue'::entry_kind AND base.bank_id IS NULL THEN 'الإيراد بلا بنك أو خزينة'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.kind = 'expense'::entry_kind AND base.movement_type <> 'custody_expense'::movement_type AND base.bank_id IS NULL THEN 'المصروف بلا بنك أو خزينة'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.movement_type = 'custody_expense'::movement_type AND base.bank_id IS NOT NULL THEN 'مصروف من العهدة لا يُربط ببنك لأن المال خرج من يد الموظف'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN (base.movement_type = ANY (ARRAY['custody_out'::movement_type, 'custody_expense'::movement_type, 'custody_return'::movement_type])) AND base.cost_center_id IS NULL THEN 'حركة عهدة بلا مركز تكلفة فلا تظهر في رصيد أي عهدة'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN (base.movement_type = ANY (ARRAY['custody_out'::movement_type, 'custody_expense'::movement_type, 'custody_return'::movement_type])) AND base.cost_center_id IS NOT NULL AND base.cc_is_custody IS NOT TRUE THEN 'حركة عهدة على مركز تكلفة لا يبدأ اسمه بكلمة عهد'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.cc_is_custody AND base.movement_type = 'operational'::movement_type THEN 'مركز تكلفة عهدة مع حركة تشغيلية'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.entry_date > CURRENT_DATE THEN 'تاريخ القيد في المستقبل'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN base.debt_id IS NOT NULL AND base.debt_paid > (base.debt_total + 0.005) THEN 'دفعات هذه المديونية تجاوزت إجماليها'::text
                    ELSE NULL::text
                END], NULL::text) AS issues
           FROM base
        )
 SELECT id,
    kind,
    entry_code,
    amount,
    description,
    entry_date,
    movement_type,
    recon_status,
    bank_name,
    account_name,
    ledger_name,
    cost_center_name,
    revenue_type_name,
    creditor_name,
    debt_id,
    issues,
    cardinality(issues) AS issue_count
   FROM flagged
  WHERE cardinality(issues) > 0;

create view v_debt_issues with (security_invoker = true) as
 SELECT id,
    description,
    creditor_name,
    total_amount,
    paid_amount,
    remaining,
    due_date,
    state,
    array_remove(ARRAY[
        CASE
            WHEN state = 'overdue'::text THEN 'مديونية فات تاريخ استحقاقها ولم تُسدد بالكامل'::text
            ELSE NULL::text
        END,
        CASE
            WHEN paid_amount > (total_amount + 0.005) THEN 'المدفوع أكبر من إجمالي المديونية'::text
            ELSE NULL::text
        END,
        CASE
            WHEN state = 'open'::text AND payment_count = 0 AND debt_date < (CURRENT_DATE - 30) THEN 'مديونية مسجلة من أكثر من شهر بلا أي دفعة'::text
            ELSE NULL::text
        END], NULL::text) AS issues
   FROM v_debt_balances db
  WHERE cardinality(array_remove(ARRAY[
        CASE
            WHEN state = 'overdue'::text THEN '1'::text
            ELSE NULL::text
        END,
        CASE
            WHEN paid_amount > (total_amount + 0.005) THEN '1'::text
            ELSE NULL::text
        END,
        CASE
            WHEN state = 'open'::text AND payment_count = 0 AND debt_date < (CURRENT_DATE - 30) THEN '1'::text
            ELSE NULL::text
        END], NULL::text)) > 0;
