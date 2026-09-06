-- جدول settings مفتاحه smallint لا uuid، فكان مشغّل التدقيق يفشل عند حفظ
-- سعر الصرف أو اسم الشركة. نترك row_id فارغًا لأي جدول مفتاحه ليس uuid.

create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text;
  rid uuid;
begin
  raw := to_jsonb(coalesce(new, old)) ->> 'id';
  if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    rid := raw::uuid;
  end if;

  if tg_op = 'DELETE' then
    insert into audit_log (table_name, row_id, action, old_data, changed_by)
    values (tg_table_name, rid, tg_op, to_jsonb(old), auth.uid());
    return old;
  end if;

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

-- سعر الصرف الصحيح من ملف أغسطس (خانة «سعر صرف الدولار» في Dashboard)
update settings set usd_rate = 50.22 where usd_rate = 48.5;
