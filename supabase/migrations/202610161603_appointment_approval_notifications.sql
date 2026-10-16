-- OralCare+ appointment approval lifecycle and notification centre
-- Applied against the managed Supabase project by the parent agent.


alter table public.appointments
  add column if not exists booking_reference text,
  add column if not exists price_cents integer,
  add column if not exists deposit_cents integer,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejection_reason text,
  add column if not exists deposit_due_at timestamptz;

update public.appointments
set booking_reference = 'OC-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where booking_reference is null;

alter table public.appointments
  alter column booking_reference set default ('OC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

create unique index if not exists appointments_booking_reference_key on public.appointments(booking_reference);
create index if not exists appointments_patient_status_idx on public.appointments(patient_id, status, starts_at);

alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending_approval', 'approved_deposit_required', 'pending_payment', 'confirmed', 'deposit_paid'));

drop table if exists public.notifications;
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select using (user_id = auth.uid() or is_staff());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_staff_insert on public.notifications;
create policy notifications_staff_insert on public.notifications for insert with check (is_staff());

drop policy if exists appointments_patient_update on public.appointments;
drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments for update using (is_staff()) with check (is_staff());

create or replace function public.create_appointment_request(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_patient_note text,
  p_policy_accepted_at timestamptz
)
returns table (
  id uuid,
  booking_reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  price_cents integer,
  deposit_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_id uuid;
  v_booking_reference text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_service from public.services
  where services.id = p_service_id and published = true
  limit 1;
  if not found or v_service.duration_minutes is null or v_service.deposit_cents is null or v_service.price_mode = 'pending' then
    raise exception 'service_not_configured';
  end if;
  if p_ends_at <= p_starts_at or extract(epoch from (p_ends_at - p_starts_at)) <> v_service.duration_minutes * 60 then
    raise exception 'invalid_duration';
  end if;
  if exists (
    select 1 from public.appointments a
    where tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      and a.status in ('pending_approval', 'approved_deposit_required', 'pending_payment', 'confirmed', 'deposit_paid')
  ) then
    raise exception 'slot_unavailable';
  end if;
  insert into public.appointments (
    patient_id, service_id, starts_at, ends_at, timezone, status,
    policy_accepted_at, patient_note, price_cents, deposit_cents
  ) values (
    auth.uid(), v_service.id, p_starts_at, p_ends_at, coalesce(nullif(p_timezone, ''), 'America/Toronto'),
    'pending_approval', p_policy_accepted_at, nullif(trim(p_patient_note), ''),
    coalesce(v_service.price_min_cents, 0), v_service.deposit_cents
  ) returning appointments.id, appointments.booking_reference into v_id, v_booking_reference;
  return query select a.id, a.booking_reference, a.starts_at, a.ends_at, a.status, a.price_cents, a.deposit_cents
    from public.appointments a where a.id = v_id;
end;
$$;
revoke all on function public.create_appointment_request(uuid, timestamptz, timestamptz, text, text, timestamptz) from public;
grant execute on function public.create_appointment_request(uuid, timestamptz, timestamptz, text, text, timestamptz) to authenticated;
