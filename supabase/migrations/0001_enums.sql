-- الأنواع المعدودة الأساسية للنظام
create type entry_kind as enum ('revenue', 'expense');

create type movement_type as enum (
  'operational',        -- تشغيلي
  'internal_transfer',  -- تحويل داخلي
  'custody_out',        -- صرف عهدة
  'custody_expense',    -- مصروف من العهدة
  'custody_return'      -- مرتجع عهدة
);

create type recon_status as enum ('pending', 'reconciled');

create type debt_status as enum ('open', 'cancelled');

-- تحويل التسميات العربية القادمة من الإكسل إلى قيم enum
create or replace function ar_movement_type(p text)
returns movement_type
language sql
immutable
as $$
  select case btrim(coalesce(p, ''))
    when 'تشغيلي' then 'operational'
    when 'تحويل داخلي' then 'internal_transfer'
    when 'صرف عهدة' then 'custody_out'
    when 'مصروف من العهدة' then 'custody_expense'
    when 'مرتجع عهدة' then 'custody_return'
    else 'operational'
  end::movement_type;
$$;

create or replace function ar_recon_status(p text)
returns recon_status
language sql
immutable
as $$
  select case btrim(coalesce(p, ''))
    when 'تمت' then 'reconciled'
    else 'pending'
  end::recon_status;
$$;
