create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_date timestamptz not null,
  venue_name text,
  maps_url text,
  parking_info text,
  contact_phone text,
  message_template text,
  invitation_image_url text,
  default_channel text default 'sms' check (default_channel in ('sms', 'whatsapp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  phone text not null,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('מגיע', 'לא מגיע', 'לא יודע')),
  attendees_count int not null check (attendees_count > 0),
  vegetarian_count int not null default 0 check (vegetarian_count >= 0),
  kids_meals_count int not null default 0 check (kids_meals_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp')),
  twilio_sid text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_event_id on public.guests(event_id);
create index if not exists idx_rsvp_event_id on public.rsvp_responses(event_id);
create index if not exists idx_message_logs_event_id on public.message_logs(event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

drop trigger if exists trg_rsvp_updated_at on public.rsvp_responses;
create trigger trg_rsvp_updated_at
before update on public.rsvp_responses
for each row
execute function public.set_updated_at();
