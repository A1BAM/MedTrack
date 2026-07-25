-- 001_init.sql
-- Schema for the medication effectiveness tracker.
-- Apply with `npm run migrate`, or paste into the Neon SQL editor.

create table if not exists doses (
  id        serial primary key,
  taken_at  timestamptz not null default now(),
  amount    numeric not null,          -- mg
  notes     text
);

create table if not exists check_ins (
  id            serial primary key,
  dose_id       int references doses(id) on delete cascade,  -- nullable: a check-in can be unlinked
  recorded_at   timestamptz not null default now(),
  effectiveness smallint not null check (effectiveness between 0 and 10),
  side_effects  text,
  notes         text
);

create index if not exists doses_taken_at_idx on doses (taken_at desc);
create index if not exists check_ins_recorded_at_idx on check_ins (recorded_at desc);
create index if not exists check_ins_dose_id_idx on check_ins (dose_id);
