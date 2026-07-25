-- 002_peaks.sql
-- Replaces the 0-10 effectiveness rating with the time the peak occurred,
-- and renames check_ins -> peaks to match. Safe to run more than once.

do $$
begin
  if to_regclass('public.check_ins') is not null
     and to_regclass('public.peaks') is null then
    alter table check_ins rename to peaks;
  end if;
end $$;

alter table peaks add column if not exists peak_at timestamptz;
update peaks set peak_at = recorded_at where peak_at is null;
alter table peaks alter column peak_at set default now();
alter table peaks alter column peak_at set not null;

-- The rating is gone; the peak time replaces it.
alter table peaks drop column if exists effectiveness;

drop index if exists check_ins_recorded_at_idx;
drop index if exists check_ins_dose_id_idx;
create index if not exists peaks_peak_at_idx on peaks (peak_at desc);
create index if not exists peaks_dose_id_idx on peaks (dose_id);
