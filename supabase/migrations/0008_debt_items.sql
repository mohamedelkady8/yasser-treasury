-- بنود المديونية: المورد يقدّم مقايسة ببنود، لكل بند كمية وسعر وحدة،
-- وإجمالي المديونية يُحسب من البنود ولا يُكتب يدويًا.

create table debt_items (
  id          uuid primary key default gen_random_uuid(),
  debt_id     uuid not null references debts (id) on delete cascade,
  name        text not null check (btrim(name) <> ''),
  unit        text,
  quantity    numeric(14, 3) not null check (quantity > 0),
  unit_price  numeric(14, 2) not null check (unit_price >= 0),
  -- محسوب في القاعدة فلا يمكن أن يختلف عن الكمية × السعر
  line_total  numeric(16, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index debt_items_debt_idx on debt_items (debt_id, sort_order);

-- إجمالي المديونية = مجموع بنودها. يُحدَّث تلقائيًا مع أي تعديل على البنود.
-- إن لم يبق أي بند نُبقي الإجمالي كما هو، لأن القاعدة تشترط أن يكون أكبر من صفر.
create or replace function sync_debt_total()
returns trigger
language plpgsql
as $$
declare
  target uuid;
  items_total numeric;
begin
  target := coalesce(new.debt_id, old.debt_id);

  select sum(line_total) into items_total
    from debt_items
   where debt_id = target;

  if items_total is not null and items_total > 0 then
    update debts set total_amount = items_total where id = target;
  end if;

  return null;
end;
$$;

create trigger debt_items_sync_total
after insert or update or delete on debt_items
for each row execute function sync_debt_total();

-- نفس سياسة بقية الجداول: المستخدم المسجّل يقرأ ويكتب
alter table debt_items enable row level security;

create policy debt_items_all on debt_items
  for all to authenticated using (true) with check (true);

create trigger debt_items_audit
after insert or update or delete on debt_items
for each row execute function audit_trigger();

-- حفظ المديونية وبنودها في معاملة واحدة، والإجمالي من البنود لا من المستخدم
create or replace function f_save_debt(
  p_id    uuid,
  p_debt  jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id    uuid;
  v_total numeric;
begin
  select coalesce(
           sum(round((i ->> 'quantity')::numeric * (i ->> 'unit_price')::numeric, 2)),
           0
         )
    into v_total
    from jsonb_array_elements(p_items) i;

  if v_total <= 0 then
    raise exception 'إجمالي البنود يجب أن يكون أكبر من صفر'
      using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into debts (
      creditor_id, description, total_amount, debt_date, due_date,
      account_id, ledger_id, cost_center_id, status, note, created_by
    )
    values (
      (p_debt ->> 'creditor_id')::uuid,
      p_debt ->> 'description',
      v_total,
      (p_debt ->> 'debt_date')::date,
      nullif(p_debt ->> 'due_date', '')::date,
      nullif(p_debt ->> 'account_id', '')::uuid,
      nullif(p_debt ->> 'ledger_id', '')::uuid,
      nullif(p_debt ->> 'cost_center_id', '')::uuid,
      coalesce((p_debt ->> 'status')::debt_status, 'open'),
      nullif(p_debt ->> 'note', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    v_id := p_id;
    update debts set
      creditor_id    = (p_debt ->> 'creditor_id')::uuid,
      description    = p_debt ->> 'description',
      total_amount   = v_total,
      debt_date      = (p_debt ->> 'debt_date')::date,
      due_date       = nullif(p_debt ->> 'due_date', '')::date,
      account_id     = nullif(p_debt ->> 'account_id', '')::uuid,
      ledger_id      = nullif(p_debt ->> 'ledger_id', '')::uuid,
      cost_center_id = nullif(p_debt ->> 'cost_center_id', '')::uuid,
      status         = coalesce((p_debt ->> 'status')::debt_status, 'open'),
      note           = nullif(p_debt ->> 'note', '')
    where id = v_id;

    if not found then
      raise exception 'المديونية غير موجودة' using errcode = 'no_data_found';
    end if;
  end if;

  -- البنود تُستبدل بالكامل: أبسط من مطابقة كل بند وأضمن للاتساق
  delete from debt_items where debt_id = v_id;

  insert into debt_items (debt_id, name, unit, quantity, unit_price, sort_order)
  select
    v_id,
    i.value ->> 'name',
    nullif(i.value ->> 'unit', ''),
    (i.value ->> 'quantity')::numeric,
    (i.value ->> 'unit_price')::numeric,
    i.ordinality::integer
  from jsonb_array_elements(p_items) with ordinality as i(value, ordinality);

  return v_id;
end;
$$;

grant execute on function f_save_debt(uuid, jsonb, jsonb) to authenticated;
