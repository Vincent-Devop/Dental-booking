create unique index if not exists payments_appointment_id_key on public.payments (appointment_id);

create or replace function public.create_pending_payment(p_appointment_id uuid)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  service_deposit integer;
  service_currency text;
  payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select a.*
    into appointment_row
    from public.appointments a
   where a.id = p_appointment_id
     and a.patient_id = auth.uid()
   for update;

  if not found then
    raise exception 'appointment_not_found';
  end if;

  if appointment_row.status <> 'pending_payment' then
    raise exception 'appointment_not_payable';
  end if;

  select s.deposit_cents, s.currency
    into service_deposit, service_currency
    from public.services s
   where s.id = appointment_row.service_id
     and s.published = true;

  if service_deposit is null then
    raise exception 'deposit_not_configured';
  end if;

  insert into public.payments (appointment_id, patient_id, provider, amount_cents, currency, status)
  values (appointment_row.id, appointment_row.patient_id, 'paypal', service_deposit, service_currency, 'pending')
  on conflict (appointment_id) do update
    set amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        provider = 'paypal',
        status = case when public.payments.status = 'paid' then public.payments.status else 'pending'::payment_status end,
        updated_at = now()
  returning public.payments.id into payment_id;

  return query select payment_id;
end;
$$;

revoke all on function public.create_pending_payment(uuid) from public, anon;
grant execute on function public.create_pending_payment(uuid) to authenticated;
