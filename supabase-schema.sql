-- ============================================================
-- CINQ PORTAL — Supabase SQL Schema
-- Paste this into Supabase > SQL Editor > New query > Run
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ----------------------------------------
-- CLIENTS
-- ----------------------------------------
create table clients (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  name            text not null,
  contact_name    text not null,
  contact_email   text not null unique,
  logo_url        text,
  notes           text
);

-- ----------------------------------------
-- PROJECTS
-- ----------------------------------------
create table projects (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  client_id       uuid references clients(id) on delete cascade,
  title           text not null,
  scope           text,
  status          text default 'active' check (status in ('proposal_sent','active','complete','on_hold')),
  start_date      date,
  end_date        date,
  total_weeks     integer,
  current_week    integer default 1
);

-- ----------------------------------------
-- DELIVERABLES
-- ----------------------------------------
create table deliverables (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  project_id      uuid references projects(id) on delete cascade,
  name            text not null,
  description     text,
  status          text default 'not_started' check (status in ('not_started','in_progress','awaiting_approval','approved','complete')),
  revision_used   integer default 0,
  revision_max    integer default 3,
  sort_order      integer default 0
);

-- ----------------------------------------
-- PRESENTATION SLIDES
-- ----------------------------------------
create table presentation_slides (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  deliverable_id  uuid references deliverables(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  image_url       text not null,
  caption         text,
  sort_order      integer default 0
);

-- ----------------------------------------
-- DECISION LOG
-- ----------------------------------------
create table decision_log (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  project_id      uuid references projects(id) on delete cascade,
  entry           text not null,
  logged_at       timestamptz default now()
);

-- ----------------------------------------
-- PROPOSAL ITEMS
-- ----------------------------------------
create table proposal_items (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  project_id          uuid references projects(id) on delete cascade,
  name                text not null,
  description         text,
  price               integer not null, -- in cents
  timeline_weeks_min  integer default 2,
  timeline_weeks_max  integer default 4,
  phase               text default 'now' check (phase in ('now','later')),
  accepted            boolean default false,
  is_recommended      boolean default false,
  sort_order          integer default 0
);

-- ----------------------------------------
-- INVOICES
-- ----------------------------------------
create table invoices (
  id                          uuid primary key default uuid_generate_v4(),
  created_at                  timestamptz default now(),
  project_id                  uuid references projects(id) on delete cascade,
  client_id                   uuid references clients(id) on delete cascade,
  invoice_number              text not null,
  description                 text not null,
  amount                      integer not null, -- in cents
  status                      text default 'draft' check (status in ('draft','sent','paid','overdue')),
  due_date                    date,
  paid_at                     timestamptz,
  stripe_payment_intent_id    text,
  unlocks_files               boolean default false
);

-- ----------------------------------------
-- BRAND ASSETS (files in the brand library)
-- ----------------------------------------
create table brand_assets (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  project_id      uuid references projects(id) on delete cascade,
  name            text not null,
  file_url        text not null,
  file_type       text not null,
  file_size_bytes integer default 0,
  category        text default 'other' check (category in ('logo','color','typography','guidelines','source','other')),
  sort_order      integer default 0
);

-- ----------------------------------------
-- COLOR SWATCHES
-- ----------------------------------------
create table color_swatches (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid references projects(id) on delete cascade,
  name            text not null,
  hex             text not null,
  sort_order      integer default 0
);

-- ----------------------------------------
-- TYPEFACES
-- ----------------------------------------
create table typeface_entries (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid references projects(id) on delete cascade,
  name            text not null,
  weight          text not null,
  role            text not null,
  file_url        text,
  sort_order      integer default 0
);

-- ----------------------------------------
-- MESSAGES
-- ----------------------------------------
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  project_id      uuid references projects(id) on delete cascade,
  from_client     boolean default true,
  sender_name     text not null,
  body            text not null,
  read            boolean default false
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table clients             enable row level security;
alter table projects            enable row level security;
alter table deliverables        enable row level security;
alter table presentation_slides enable row level security;
alter table decision_log        enable row level security;
alter table proposal_items      enable row level security;
alter table invoices            enable row level security;
alter table brand_assets        enable row level security;
alter table color_swatches      enable row level security;
alter table typeface_entries    enable row level security;
alter table messages            enable row level security;

-- Admin (Kacie) can do anything — checks against ADMIN_EMAIL env var
-- We use a helper function to check if the current user is admin
create or replace function is_admin()
returns boolean as $$
  select auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
$$ language sql security definer;

-- Client can only see their own data — matched by email
create or replace function client_email()
returns text as $$
  select auth.jwt() ->> 'email'
$$ language sql security definer;

-- CLIENTS policies
create policy "Admin full access to clients"
  on clients for all using (is_admin());

create policy "Client reads own record"
  on clients for select
  using (contact_email = client_email());

-- PROJECTS policies
create policy "Admin full access to projects"
  on projects for all using (is_admin());

create policy "Client reads own projects"
  on projects for select
  using (
    client_id in (
      select id from clients where contact_email = client_email()
    )
  );

-- DELIVERABLES policies
create policy "Admin full access to deliverables"
  on deliverables for all using (is_admin());

create policy "Client reads own deliverables"
  on deliverables for select
  using (
    project_id in (
      select p.id from projects p
      join clients c on c.id = p.client_id
      where c.contact_email = client_email()
    )
  );

-- Apply same pattern to remaining tables
create policy "Admin full access" on presentation_slides for all using (is_admin());
create policy "Client reads own" on presentation_slides for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));

create policy "Admin full access" on decision_log for all using (is_admin());
create policy "Client reads own" on decision_log for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));

create policy "Admin full access" on proposal_items for all using (is_admin());
create policy "Client reads own" on proposal_items for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));
create policy "Client updates own proposal items" on proposal_items for update using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));

create policy "Admin full access" on invoices for all using (is_admin());
create policy "Client reads own invoices" on invoices for select using (client_id in (select id from clients where contact_email = client_email()));

create policy "Admin full access" on brand_assets for all using (is_admin());
create policy "Client reads own assets" on brand_assets for select using (
  project_id in (
    select p.id from projects p
    join clients c on c.id = p.client_id
    join invoices i on i.project_id = p.id
    where c.contact_email = client_email()
    and i.unlocks_files = true
    and i.status = 'paid'
  )
);

create policy "Admin full access" on color_swatches for all using (is_admin());
create policy "Client reads own" on color_swatches for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));

create policy "Admin full access" on typeface_entries for all using (is_admin());
create policy "Client reads own" on typeface_entries for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));

create policy "Admin full access" on messages for all using (is_admin());
create policy "Client reads own messages" on messages for select using (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()));
create policy "Client sends messages" on messages for insert with check (project_id in (select p.id from projects p join clients c on c.id = p.client_id where c.contact_email = client_email()) and from_client = true);

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase dashboard)
-- ============================================================
-- Create these buckets in Storage > New bucket:
--   1. "deliverables"  — private, for presentation slides and uploaded work
--   2. "brand-assets"  — private, for final brand library files
