-- For a NEW CAGE Geo Intelligence Supabase project only.
create extension if not exists pgcrypto;
create extension if not exists postgis;
create schema if not exists geo;

create table geo.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create table geo.memberships (
  organization_id uuid not null references geo.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','mission_manager','pilot','analyst','client')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

-- Definer function avoids recursive membership policy checks. Never expose arbitrary membership inserts.
create function geo.has_membership(org uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from geo.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;
revoke all on function geo.has_membership(uuid,text[]) from public;
grant execute on function geo.has_membership(uuid,text[]) to authenticated;

create table geo.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references geo.organizations(id),
  name text not null check (length(trim(name)) > 0),
  boundary geometry(MultiPolygon,4326),
  status text not null default 'active' check (status in ('active','on_hold','complete','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index projects_boundary_gix on geo.projects using gist (boundary);

create table geo.missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  assigned_pilot uuid references auth.users(id),
  status text not null default 'planned' check (status in ('planned','assigned','collecting','uploaded','cancelled')),
  flight_spec jsonb not null default '{}'::jsonb,
  planned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id,organization_id) references geo.projects(id,organization_id)
);
create table geo.datasets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  mission_id uuid,
  sensor text not null,
  acquired_at timestamptz,
  footprint geometry(MultiPolygon,4326),
  source_crs text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'registered' check (status in ('registered','uploading','uploaded','quarantined','validated')),
  created_at timestamptz not null default now(),
  unique (id,organization_id),
  foreign key (project_id,organization_id) references geo.projects(id,organization_id),
  foreign key (mission_id,organization_id) references geo.missions(id,organization_id)
);
create index datasets_footprint_gix on geo.datasets using gist (footprint);
create table geo.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dataset_id uuid not null,
  object_key text not null,
  media_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('source','derived','report')),
  created_at timestamptz not null default now(),
  unique (organization_id,object_key),
  foreign key (dataset_id,organization_id) references geo.datasets(id,organization_id)
);
create table geo.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dataset_id uuid not null,
  workflow text not null,
  workflow_version text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','validating','processing','verifying','review_required','approved','published','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  approved_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (dataset_id,organization_id) references geo.datasets(id,organization_id)
);
create index processing_jobs_queue_idx on geo.processing_jobs(status,created_at);
create table geo.quality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dataset_id uuid not null,
  check_name text not null,
  passed boolean not null,
  measurement jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  foreign key (dataset_id,organization_id) references geo.datasets(id,organization_id)
);
create table geo.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dataset_id uuid not null,
  algorithm text not null,
  version text not null,
  parameters jsonb not null default '{}'::jsonb,
  findings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (dataset_id,organization_id) references geo.datasets(id,organization_id)
);
create table geo.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','approved','published','withdrawn')),
  approved_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id,organization_id) references geo.projects(id,organization_id)
);
create table geo.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references geo.organizations(id),
  actor_id uuid references auth.users(id),
  event text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Only authenticated members read their organization's metadata.
-- Mutations go through trusted service endpoints that verify role and log activity.
do $$ declare t text; begin
  foreach t in array array['organizations','memberships','projects','missions','datasets','assets','processing_jobs','quality_checks','analysis_runs','deliverables','audit_events'] loop
    execute format('alter table geo.%I enable row level security',t);
  end loop;
end $$;
create policy organization_read on geo.organizations for select to authenticated
  using (geo.has_membership(id));
create policy membership_read on geo.memberships for select to authenticated
  using (geo.has_membership(organization_id));
create policy project_read on geo.projects for select to authenticated
  using (geo.has_membership(organization_id));
create policy mission_read on geo.missions for select to authenticated
  using (geo.has_membership(organization_id));
create policy dataset_read on geo.datasets for select to authenticated
  using (geo.has_membership(organization_id));
create policy asset_read on geo.assets for select to authenticated
  using (geo.has_membership(organization_id));
create policy job_read on geo.processing_jobs for select to authenticated
  using (geo.has_membership(organization_id));
create policy quality_read on geo.quality_checks for select to authenticated
  using (geo.has_membership(organization_id));
create policy analysis_read on geo.analysis_runs for select to authenticated
  using (geo.has_membership(organization_id));
create policy deliverable_read on geo.deliverables for select to authenticated
  using (geo.has_membership(organization_id));
create policy audit_read on geo.audit_events for select to authenticated
  using (geo.has_membership(organization_id,array['admin','analyst']));

-- Schema is not exposed through PostgREST by default; trusted backend uses
-- service credentials after its own identity/tenant authorization checks.
revoke all on schema geo from public, anon;
grant usage on schema geo to authenticated;
grant select on all tables in schema geo to authenticated;
