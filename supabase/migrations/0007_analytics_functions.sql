-- دوال التحليل بفلتر فترة

CREATE OR REPLACE FUNCTION public.f_daily_movement(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(day date, revenue numeric, expense numeric, net numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    e.entry_date,
    coalesce(sum(e.amount) filter (where e.kind = 'revenue' and e.movement_type = 'operational'), 0),
    coalesce(sum(e.amount) filter (where e.kind = 'expense' and e.movement_type in ('operational', 'custody_expense')), 0),
    coalesce(sum(e.amount) filter (where e.kind = 'revenue' and e.movement_type = 'operational'), 0)
      - coalesce(sum(e.amount) filter (where e.kind = 'expense' and e.movement_type in ('operational', 'custody_expense')), 0)
  from entries e
  where (p_from is null or e.entry_date >= p_from)
    and (p_to   is null or e.entry_date <= p_to)
  group by e.entry_date
  order by e.entry_date;
$function$
;

CREATE OR REPLACE FUNCTION public.f_expense_by_account(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS TABLE(name text, total numeric, cnt bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(a.name, 'غير محدد'), sum(e.amount), count(*)
  from entries e
  left join accounts a on a.id = e.account_id
  where e.kind = 'expense'
    and e.movement_type in ('operational', 'custody_expense')
    and (p_from is null or e.entry_date >= p_from)
    and (p_to   is null or e.entry_date <= p_to)
  group by 1
  order by 2 desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.f_expense_by_cost_center(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS TABLE(name text, total numeric, cnt bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(cc.name, 'غير محدد'), sum(e.amount), count(*)
  from entries e
  left join cost_centers cc on cc.id = e.cost_center_id
  where e.kind = 'expense'
    and e.movement_type in ('operational', 'custody_expense')
    and (p_from is null or e.entry_date >= p_from)
    and (p_to   is null or e.entry_date <= p_to)
  group by 1
  order by 2 desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.f_expense_by_ledger(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS TABLE(name text, total numeric, cnt bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(l.name, 'غير محدد'), sum(e.amount), count(*)
  from entries e
  left join ledgers l on l.id = e.ledger_id
  where e.kind = 'expense'
    and e.movement_type in ('operational', 'custody_expense')
    and (p_from is null or e.entry_date >= p_from)
    and (p_to   is null or e.entry_date <= p_to)
  group by 1
  order by 2 desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.f_monthly_summary()
 RETURNS TABLE(month date, revenue numeric, expense numeric, net numeric, entry_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    date_trunc('month', e.entry_date)::date,
    coalesce(sum(e.amount) filter (where e.kind = 'revenue' and e.movement_type = 'operational'), 0),
    coalesce(sum(e.amount) filter (where e.kind = 'expense' and e.movement_type in ('operational', 'custody_expense')), 0),
    coalesce(sum(e.amount) filter (where e.kind = 'revenue' and e.movement_type = 'operational'), 0)
      - coalesce(sum(e.amount) filter (where e.kind = 'expense' and e.movement_type in ('operational', 'custody_expense')), 0),
    count(*)
  from entries e
  group by 1
  order by 1 desc;
$function$
;

CREATE OR REPLACE FUNCTION public.f_operational_totals(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(revenue numeric, revenue_excl_opening numeric, opening_balances numeric, expense numeric, net numeric, revenue_count bigint, expense_count bigint, internal_transfers numeric, custody_out_total numeric, custody_expense_total numeric, custody_return_total numeric)
 LANGUAGE sql
 STABLE
AS $function$
  with f as (
    select e.*, coalesce(rt.is_opening, false) as is_opening
    from entries e
    left join revenue_types rt on rt.id = e.revenue_type_id
    where (p_from is null or e.entry_date >= p_from)
      and (p_to   is null or e.entry_date <= p_to)
  )
  select
    coalesce(sum(amount) filter (where kind = 'revenue' and movement_type = 'operational'), 0),
    coalesce(sum(amount) filter (where kind = 'revenue' and movement_type = 'operational' and not is_opening), 0),
    coalesce(sum(amount) filter (where kind = 'revenue' and movement_type = 'operational' and is_opening), 0),
    coalesce(sum(amount) filter (where kind = 'expense' and movement_type in ('operational', 'custody_expense')), 0),
    coalesce(sum(amount) filter (where kind = 'revenue' and movement_type = 'operational'), 0)
      - coalesce(sum(amount) filter (where kind = 'expense' and movement_type in ('operational', 'custody_expense')), 0),
    coalesce(count(*) filter (where kind = 'revenue'), 0),
    coalesce(count(*) filter (where kind = 'expense'), 0),
    coalesce(sum(amount) filter (where kind = 'expense' and movement_type = 'internal_transfer'), 0),
    coalesce(sum(amount) filter (where movement_type = 'custody_out'), 0),
    coalesce(sum(amount) filter (where movement_type = 'custody_expense'), 0),
    coalesce(sum(amount) filter (where movement_type = 'custody_return'), 0)
  from f;
$function$
;

CREATE OR REPLACE FUNCTION public.f_revenue_by_type(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 20)
 RETURNS TABLE(name text, total numeric, cnt bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(rt.name, 'غير محدد'), sum(e.amount), count(*)
  from entries e
  left join revenue_types rt on rt.id = e.revenue_type_id
  where e.kind = 'revenue'
    and e.movement_type = 'operational'
    and (p_from is null or e.entry_date >= p_from)
    and (p_to   is null or e.entry_date <= p_to)
  group by 1
  order by 2 desc
  limit p_limit;
$function$
;
