drop policy if exists appointments_patient_insert on public.appointments;
revoke insert on public.appointments from authenticated;
