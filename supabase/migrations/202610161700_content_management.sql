alter table public.services add column if not exists image_url text;

create table if not exists public.homepage_images (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('hero','interior','care','journal')),
  image_url text not null,
  alt_text text not null default 'OralCare+ clinic image',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists homepage_images_slot_active_idx on public.homepage_images(slot, active, sort_order);

alter table public.homepage_images enable row level security;
drop policy if exists homepage_images_public_read on public.homepage_images;
create policy homepage_images_public_read on public.homepage_images for select using (active = true);
drop policy if exists homepage_images_staff_manage on public.homepage_images;
create policy homepage_images_staff_manage on public.homepage_images for all using (public.is_staff()) with check (public.is_staff());

insert into public.homepage_images (slot,image_url,alt_text,sort_order)
select * from (values
  ('hero','/oralcare-home-dental-clinic.webp','Dentist and assistant providing care to a patient in a modern dental clinic',0),
  ('interior','/manus-storage/async-images/xl7tmsJXMo8Dq68Sk5PRLa/image-2.webp','Bright, modern dental clinic interior',0),
  ('care','/manus-storage/async-images/xl7tmsJXMo8Dq68Sk5PRLa/image-3.webp','Dental professional preparing a calm examination environment',0),
  ('journal','/manus-storage/async-images/xl7tmsJXMo8Dq68Sk5PRLa/image-4.webp','OralCare+ journal image',0)
) as seed(slot,image_url,alt_text,sort_order)
where not exists (select 1 from public.homepage_images);
