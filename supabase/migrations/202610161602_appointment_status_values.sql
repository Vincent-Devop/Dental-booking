-- Commit lifecycle enum values before dependent constraints are created.
alter type public.appointment_status add value if not exists 'pending_approval';
alter type public.appointment_status add value if not exists 'approved_deposit_required';
alter type public.appointment_status add value if not exists 'deposit_paid';
alter type public.appointment_status add value if not exists 'rejected';
alter type public.appointment_status add value if not exists 'payment_failed';
