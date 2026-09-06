-- أرصدة البنوك والعهد والمديونيات والمتاح بعد السداد

create view v_entries with (security_invoker = true) as
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
    rt.name AS revenue_type_name,
    rt.is_opening AS revenue_is_opening,
    a.name AS account_name,
    l.name AS ledger_name,
    cc.name AS cost_center_name,
    cc.is_custody AS cost_center_is_custody,
    b.name AS bank_name,
    b.is_usd AS bank_is_usd,
    d.description AS debt_description,
    cr.name AS creditor_name
   FROM entries e
     LEFT JOIN revenue_types rt ON rt.id = e.revenue_type_id
     LEFT JOIN accounts a ON a.id = e.account_id
     LEFT JOIN ledgers l ON l.id = e.ledger_id
     LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
     LEFT JOIN banks b ON b.id = e.bank_id
     LEFT JOIN debts d ON d.id = e.debt_id
     LEFT JOIN creditors cr ON cr.id = d.creditor_id;

create view v_bank_balances with (security_invoker = true) as
 WITH mv AS (
         SELECT e.bank_id,
            sum(
                CASE
                    WHEN e.kind = 'revenue'::entry_kind THEN e.amount
                    ELSE 0::numeric
                END) AS revenue_in,
            sum(
                CASE
                    WHEN e.kind = 'expense'::entry_kind AND (e.movement_type <> ALL (ARRAY['custody_expense'::movement_type, 'custody_return'::movement_type])) THEN e.amount
                    ELSE 0::numeric
                END) AS expense_out,
            sum(
                CASE
                    WHEN e.kind = 'expense'::entry_kind AND e.movement_type = 'custody_return'::movement_type THEN e.amount
                    ELSE 0::numeric
                END) AS custody_back,
            count(*) AS entry_count
           FROM entries e
          WHERE e.bank_id IS NOT NULL
          GROUP BY e.bank_id
        )
 SELECT b.id,
    b.name,
    b.is_usd,
    b.is_active,
    b.sort_order,
    b.opening_balance,
    COALESCE(mv.revenue_in, 0::numeric) AS revenue_in,
    COALESCE(mv.expense_out, 0::numeric) AS expense_out,
    COALESCE(mv.custody_back, 0::numeric) AS custody_back,
    COALESCE(mv.revenue_in, 0::numeric) - COALESCE(mv.expense_out, 0::numeric) + COALESCE(mv.custody_back, 0::numeric) AS net_movement,
    b.opening_balance + COALESCE(mv.revenue_in, 0::numeric) - COALESCE(mv.expense_out, 0::numeric) + COALESCE(mv.custody_back, 0::numeric) AS balance,
    COALESCE(mv.entry_count, 0::bigint) AS entry_count
   FROM banks b
     LEFT JOIN mv ON mv.bank_id = b.id;

create view v_custody_balances with (security_invoker = true) as
 WITH mv AS (
         SELECT e.cost_center_id,
            sum(
                CASE
                    WHEN e.movement_type = 'custody_out'::movement_type THEN e.amount
                    ELSE 0::numeric
                END) AS paid_out,
            sum(
                CASE
                    WHEN e.movement_type = 'custody_expense'::movement_type THEN e.amount
                    ELSE 0::numeric
                END) AS spent,
            sum(
                CASE
                    WHEN e.movement_type = 'custody_return'::movement_type THEN e.amount
                    ELSE 0::numeric
                END) AS returned,
            max(e.entry_date) AS last_movement
           FROM entries e
          WHERE e.kind = 'expense'::entry_kind AND e.cost_center_id IS NOT NULL
          GROUP BY e.cost_center_id
        )
 SELECT cc.id,
    cc.name,
    cc.custody_holder,
    cc.custody_opening,
    cc.is_active,
    COALESCE(mv.paid_out, 0::numeric) AS paid_out,
    COALESCE(mv.spent, 0::numeric) AS spent,
    COALESCE(mv.returned, 0::numeric) AS returned,
    mv.last_movement,
    cc.custody_opening + COALESCE(mv.paid_out, 0::numeric) - COALESCE(mv.spent, 0::numeric) - COALESCE(mv.returned, 0::numeric) AS balance,
        CASE
            WHEN abs(cc.custody_opening + COALESCE(mv.paid_out, 0::numeric) - COALESCE(mv.spent, 0::numeric) - COALESCE(mv.returned, 0::numeric)) <= 0.005 THEN 'settled'::text
            WHEN (cc.custody_opening + COALESCE(mv.paid_out, 0::numeric) - COALESCE(mv.spent, 0::numeric) - COALESCE(mv.returned, 0::numeric)) < 0::numeric THEN 'negative'::text
            ELSE 'outstanding'::text
        END AS state
   FROM cost_centers cc
     LEFT JOIN mv ON mv.cost_center_id = cc.id
  WHERE cc.is_custody;

create view v_debt_balances with (security_invoker = true) as
 WITH paid AS (
         SELECT entries.debt_id,
            sum(entries.amount) AS paid_amount,
            count(*) AS payment_count,
            max(entries.entry_date) AS last_payment
           FROM entries
          WHERE entries.debt_id IS NOT NULL
          GROUP BY entries.debt_id
        )
 SELECT d.id,
    d.creditor_id,
    d.description,
    d.total_amount,
    d.debt_date,
    d.due_date,
    d.account_id,
    d.ledger_id,
    d.cost_center_id,
    d.status,
    d.note,
    d.created_at,
    cr.name AS creditor_name,
    a.name AS account_name,
    l.name AS ledger_name,
    cc.name AS cost_center_name,
    COALESCE(p.paid_amount, 0::numeric) AS paid_amount,
    COALESCE(p.payment_count, 0::bigint) AS payment_count,
    p.last_payment,
    d.total_amount - COALESCE(p.paid_amount, 0::numeric) AS remaining,
    round(100::numeric * COALESCE(p.paid_amount, 0::numeric) / d.total_amount, 1) AS paid_pct,
        CASE
            WHEN d.status = 'cancelled'::debt_status THEN 'cancelled'::text
            WHEN (d.total_amount - COALESCE(p.paid_amount, 0::numeric)) <= 0.005 THEN 'settled'::text
            WHEN d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE THEN 'overdue'::text
            ELSE 'open'::text
        END AS state
   FROM debts d
     JOIN creditors cr ON cr.id = d.creditor_id
     LEFT JOIN accounts a ON a.id = d.account_id
     LEFT JOIN ledgers l ON l.id = d.ledger_id
     LEFT JOIN cost_centers cc ON cc.id = d.cost_center_id
     LEFT JOIN paid p ON p.debt_id = d.id;

create view v_creditor_balances with (security_invoker = true) as
 SELECT cr.id,
    cr.name,
    cr.phone,
    cr.note,
    cr.is_active,
    count(db.id) FILTER (WHERE db.state = ANY (ARRAY['open'::text, 'overdue'::text])) AS open_debts,
    count(db.id) AS total_debts,
    COALESCE(sum(db.total_amount) FILTER (WHERE db.state <> 'cancelled'::text), 0::numeric) AS total_amount,
    COALESCE(sum(db.paid_amount) FILTER (WHERE db.state <> 'cancelled'::text), 0::numeric) AS paid_amount,
    COALESCE(sum(db.remaining) FILTER (WHERE db.state = ANY (ARRAY['open'::text, 'overdue'::text])), 0::numeric) AS remaining
   FROM creditors cr
     LEFT JOIN v_debt_balances db ON db.creditor_id = cr.id
  GROUP BY cr.id, cr.name, cr.phone, cr.note, cr.is_active;

create view v_cash_position with (security_invoker = true) as
 WITH b AS (
         SELECT COALESCE(sum(v_bank_balances.balance), 0::numeric) AS bank_total,
            COALESCE(sum(v_bank_balances.balance) FILTER (WHERE v_bank_balances.is_usd), 0::numeric) AS usd_total
           FROM v_bank_balances
        ), c AS (
         SELECT COALESCE(sum(v_custody_balances.balance), 0::numeric) AS custody_total
           FROM v_custody_balances
        ), d AS (
         SELECT COALESCE(sum(v_debt_balances.remaining), 0::numeric) AS debts_outstanding,
            count(*) FILTER (WHERE v_debt_balances.state = 'overdue'::text) AS overdue_count
           FROM v_debt_balances
          WHERE v_debt_balances.state = ANY (ARRAY['open'::text, 'overdue'::text])
        )
 SELECT b.bank_total,
    b.usd_total,
    c.custody_total,
    b.bank_total + c.custody_total AS total_cash,
    d.debts_outstanding,
    d.overdue_count,
    b.bank_total + c.custody_total - d.debts_outstanding AS available_after_debts
   FROM b,
    c,
    d;
