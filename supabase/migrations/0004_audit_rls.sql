-- سجل التعديلات: من عدّل، وماذا كان، وماذا صار
create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      uuid,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index audit_log_table_idx on audit_log (table_name, changed_at desc);
create index audit_log_row_idx on audit_log (row_id);

create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if tg_op = 'DELETE' then
    rid := (to_jsonb(old) ->> 'id')::uuid;
    insert into audit_log (table_name, row_id, action, old_data, changed_by)
    values (tg_table_name, rid, tg_op, to_jsonb(old), auth.uid());
    return old;
  end if;

  rid := (to_jsonb(new) ->> 'id')::uuid;
  insert into audit_log (table_name, row_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    rid,
    tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    auth.uid()
  );
  return new;
end;
$$;

create trigger entries_audit after insert or update or delete on entries
for each row execute function audit_trigger();

create trigger debts_audit after insert or update or delete on debts
for each row execute function audit_trigger();

create trigger banks_audit after insert or update or delete on banks
for each row execute function audit_trigger();

create trigger cost_centers_audit after insert or update or delete on cost_centers
for each row execute function audit_trigger();

create trigger creditors_audit after insert or update or delete on creditors
for each row execute function audit_trigger();

create trigger accounts_audit after insert or update or delete on accounts
for each row execute function audit_trigger();

create trigger ledgers_audit after insert or update or delete on ledgers
for each row execute function audit_trigger();

create trigger revenue_types_audit after insert or update or delete on revenue_types
for each row execute function audit_trigger();

create trigger settings_audit after insert or update or delete on settings
for each row execute function audit_trigger();

-- من أنشأ القيد
alter table entries alter column created_by set default auth.uid();
alter table debts   alter column created_by set default auth.uid();

-- ================== RLS ==================
-- مستخدم واحد لكل العمليات بلا أدوار: كل مستخدم مسجّل يقرأ ويكتب
alter table accounts      enable row level security;
alter table ledgers       enable row level security;
alter table cost_centers  enable row level security;
alter table revenue_types enable row level security;
alter table banks         enable row level security;
alter table creditors     enable row level security;
alter table settings      enable row level security;
alter table entries       enable row level security;
alter table debts         enable row level security;
alter table audit_log     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'ledgers', 'cost_centers', 'revenue_types',
    'banks', 'creditors', 'settings', 'entries', 'debts'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end
$$;

-- سجل التعديلات للقراءة فقط
create policy audit_log_read on public.audit_log
for select to authenticated using (true);
