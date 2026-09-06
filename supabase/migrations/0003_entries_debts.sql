-- المديونيات: الالتزام المتفق عليه مع المورد، والدفعات تُسجَّل كقيود مصروف مربوطة به
create table debts (
  id              uuid primary key default gen_random_uuid(),
  creditor_id     uuid not null references creditors (id) on delete restrict,
  description     text not null,
  total_amount    numeric(14, 2) not null check (total_amount > 0),
  debt_date       date not null default current_date,
  due_date        date,
  -- التصنيف يُحدَّد مرة واحدة على المديونية وترثه كل دفعة تلقائيًا
  account_id      uuid references accounts (id) on delete set null,
  ledger_id       uuid references ledgers (id) on delete set null,
  cost_center_id  uuid references cost_centers (id) on delete set null,
  status          debt_status not null default 'open',
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null
);
create index debts_creditor_idx on debts (creditor_id);
create index debts_status_idx on debts (status);
create index debts_due_idx on debts (due_date);

-- جدول واحد للحركات: كل حسابات الأرصدة والعهد تمرّ على الإيراد والمصروف معًا
create table entries (
  id              uuid primary key default gen_random_uuid(),
  kind            entry_kind not null,
  entry_code      text not null,
  amount          numeric(14, 2) not null check (amount > 0),
  description     text,
  entry_date      date not null,
  revenue_type_id uuid references revenue_types (id) on delete restrict,
  account_id      uuid references accounts (id) on delete restrict,
  ledger_id       uuid references ledgers (id) on delete restrict,
  -- يبقى nullable: 128 قيدًا حقيقيًا في أغسطس بلا مركز تكلفة
  cost_center_id  uuid references cost_centers (id) on delete restrict,
  -- NULL في «مصروف من العهدة» لأن المال خرج من يد الموظف لا من البنك
  bank_id         uuid references banks (id) on delete restrict,
  movement_type   movement_type not null default 'operational',
  recon_status    recon_status not null default 'pending',
  note            text,
  document_url    text,
  debt_id         uuid references debts (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,

  -- قيود صارمة على الثوابت فقط، فما عداها تحقّق ناعم في صفحة المراجعة
  constraint entries_revenue_no_custody check (
    kind = 'expense'
    or movement_type in ('operational', 'internal_transfer')
  ),
  constraint entries_revenue_needs_type check (
    kind <> 'revenue'
    or movement_type <> 'operational'
    or revenue_type_id is not null
  ),
  constraint entries_revenue_has_no_expense_dims check (
    kind = 'expense'
    or (account_id is null and ledger_id is null and cost_center_id is null and debt_id is null)
  ),
  constraint entries_expense_has_no_revenue_type check (
    kind = 'revenue' or revenue_type_id is null
  )
);

create unique index entries_code_kind_key on entries (entry_code, kind);
create index entries_kind_date_idx on entries (kind, entry_date desc);
create index entries_bank_idx on entries (bank_id);
create index entries_cost_center_idx on entries (cost_center_id);
create index entries_ledger_idx on entries (ledger_id);
create index entries_account_idx on entries (account_id);
create index entries_movement_idx on entries (movement_type);
create index entries_debt_idx on entries (debt_id) where debt_id is not null;

-- الدفعة لا تُربط بمديونية إلا وهي مصروف
alter table entries add constraint entries_debt_only_expense check (
  debt_id is null or kind = 'expense'
);

-- توليد رقم القيد تلقائيًا: MONYY-NNNN بتسلسل يبدأ من جديد كل شهر
create or replace function gen_entry_code()
returns trigger
language plpgsql
as $$
declare
  pfx text;
  n   integer;
begin
  if new.entry_code is null or btrim(new.entry_code) = '' then
    pfx := upper(to_char(new.entry_date, 'MON')) || to_char(new.entry_date, 'YY');
    perform pg_advisory_xact_lock(hashtext(pfx || new.kind::text));
    select coalesce(max((regexp_match(entry_code, '(\d+)$'))[1]::integer), 0) + 1
      into n
      from entries
     where kind = new.kind
       and entry_code like pfx || '-%';
    new.entry_code := pfx || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger entries_code_before_insert
before insert on entries
for each row execute function gen_entry_code();

-- تحديث updated_at تلقائيًا
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger entries_touch before update on entries
for each row execute function touch_updated_at();

create trigger debts_touch before update on debts
for each row execute function touch_updated_at();

-- ربط القيد بمديونية يورّث تصنيفها إن كان القيد بلا تصنيف
create or replace function inherit_debt_classification()
returns trigger
language plpgsql
as $$
declare
  d debts;
begin
  if new.debt_id is not null then
    select * into d from debts where id = new.debt_id;
    if found then
      new.account_id     := coalesce(new.account_id, d.account_id);
      new.ledger_id      := coalesce(new.ledger_id, d.ledger_id);
      new.cost_center_id := coalesce(new.cost_center_id, d.cost_center_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger entries_inherit_debt
before insert or update of debt_id on entries
for each row execute function inherit_debt_classification();
