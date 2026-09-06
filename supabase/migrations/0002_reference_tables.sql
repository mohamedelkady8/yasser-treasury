-- الجداول المرجعية: تحل محل القوائم المنسدلة في الإكسل بمفاتيح أجنبية حقيقية

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index accounts_name_key on accounts (btrim(name));

create table ledgers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index ledgers_name_key on ledgers (btrim(name));

create table cost_centers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  custody_opening numeric(14, 2) not null default 0,
  -- كل مركز تكلفة يبدأ اسمه بكلمة «عهد» يُعتبر عهدة، تمامًا كمنطق LEFT(x,3)="عهد" في الإكسل
  is_custody      boolean generated always as (left(btrim(name), 3) = 'عهد') stored,
  custody_holder  text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create unique index cost_centers_name_key on cost_centers (btrim(name));
create index cost_centers_custody_idx on cost_centers (is_custody) where is_custody;

create table revenue_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- «رصيد أفتتاحي» ليس إيرادًا حقيقيًا بل نقطة بداية، فنميّزه لعرض الإيراد التشغيلي الصافي
  is_opening  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index revenue_types_name_key on revenue_types (btrim(name));

create table banks (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  opening_balance numeric(14, 2) not null default 0,
  is_usd          boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);
create unique index banks_name_key on banks (btrim(name));

create table creditors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  note        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index creditors_name_key on creditors (btrim(name));

create table settings (
  id          smallint primary key default 1 check (id = 1),
  usd_rate    numeric(12, 4) not null default 48.5,
  company_name text not null default 'الشركة',
  updated_at  timestamptz not null default now()
);
insert into settings (id) values (1);
