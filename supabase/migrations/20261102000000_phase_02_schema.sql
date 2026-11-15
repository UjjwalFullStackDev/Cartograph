-- Cartograph Phase 2: Core Schema & Multi-Tenant Row Level Security
-- Eight tables: projects, analyses, files, edges, routes, explanations, file_roles, insights
-- Every table references organizations(id) on delete cascade.

-- 0. Organizations (parent table for cascade ownership)
create table if not exists public.organizations (
  id text primary key, -- Clerk organization ID (org_xxx)
  name text not null,
  slug text,
  created_at timestamptz default now() not null
);

-- 1. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  repository_url text not null,
  default_branch text default 'main' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Analyses
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  commit_hash text,
  status text not null check (status in ('pending', 'fetching', 'selecting', 'parsing', 'completed', 'failed', 'stale')),
  stage text,
  error_message text,
  file_count integer default 0 not null,
  edge_count integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. Files
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  path text not null,
  folder text not null,
  line_count integer default 0 not null,
  hash text,
  fan_in integer default 0 not null,
  fan_out integer default 0 not null,
  created_at timestamptz default now() not null
);

-- 4. Edges
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  source_file_id uuid not null references public.files(id) on delete cascade,
  target_file_id uuid references public.files(id) on delete cascade,
  target_path text not null,
  kind text not null,
  is_resolved boolean default true not null,
  unresolved_reason text,
  created_at timestamptz default now() not null
);

-- 5. Routes
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  method text not null,
  pattern text not null,
  created_at timestamptz default now() not null
);

-- 6. Explanations
create table if not exists public.explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  content text not null,
  model text,
  created_at timestamptz default now() not null
);

-- 7. File Roles
create table if not exists public.file_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  role text not null,
  confidence numeric(3,2) default 1.00 not null,
  created_at timestamptz default now() not null
);

-- 8. Insights
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  kind text not null,
  data jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

-- Foreign Key Indexes for fast JOINs and ON DELETE CASCADE
create index if not exists idx_projects_organization_id on public.projects (organization_id);

create index if not exists idx_analyses_organization_id on public.analyses (organization_id);
create index if not exists idx_analyses_project_id on public.analyses (project_id);
create index if not exists idx_analyses_org_created on public.analyses (organization_id, created_at desc);

create index if not exists idx_files_organization_id on public.files (organization_id);
create index if not exists idx_files_analysis_id on public.files (analysis_id);

create index if not exists idx_edges_organization_id on public.edges (organization_id);
create index if not exists idx_edges_analysis_id on public.edges (analysis_id);
create index if not exists idx_edges_source_file_id on public.edges (source_file_id);
create index if not exists idx_edges_target_file_id on public.edges (target_file_id);

create index if not exists idx_routes_organization_id on public.routes (organization_id);
create index if not exists idx_routes_analysis_id on public.routes (analysis_id);
create index if not exists idx_routes_file_id on public.routes (file_id);

create index if not exists idx_explanations_organization_id on public.explanations (organization_id);
create index if not exists idx_explanations_analysis_id on public.explanations (analysis_id);
create index if not exists idx_explanations_file_id on public.explanations (file_id);

create index if not exists idx_file_roles_organization_id on public.file_roles (organization_id);
create index if not exists idx_file_roles_analysis_id on public.file_roles (analysis_id);
create index if not exists idx_file_roles_file_id on public.file_roles (file_id);

create index if not exists idx_insights_organization_id on public.insights (organization_id);
create index if not exists idx_insights_analysis_id on public.insights (analysis_id);

-- Helper function: Extracts the organization claim from JWT or PostgREST settings
create or replace function public.requesting_org_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.org_id', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id')
  );
$$;

-- Enable and FORCE Row Level Security on all tables
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

alter table public.projects enable row level security;
alter table public.projects force row level security;

alter table public.analyses enable row level security;
alter table public.analyses force row level security;

alter table public.files enable row level security;
alter table public.files force row level security;

alter table public.edges enable row level security;
alter table public.edges force row level security;

alter table public.routes enable row level security;
alter table public.routes force row level security;

alter table public.explanations enable row level security;
alter table public.explanations force row level security;

alter table public.file_roles enable row level security;
alter table public.file_roles force row level security;

alter table public.insights enable row level security;
alter table public.insights force row level security;

-- Policies: Only authenticated tokens with matching org_id claim can access
drop policy if exists "organizations_org_isolation" on public.organizations;
create policy "organizations_org_isolation" on public.organizations
  for all
  to authenticated
  using (id = (select public.requesting_org_id()))
  with check (id = (select public.requesting_org_id()));

drop policy if exists "projects_org_isolation" on public.projects;
create policy "projects_org_isolation" on public.projects
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "analyses_org_isolation" on public.analyses;
create policy "analyses_org_isolation" on public.analyses
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "files_org_isolation" on public.files;
create policy "files_org_isolation" on public.files
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "edges_org_isolation" on public.edges;
create policy "edges_org_isolation" on public.edges
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "routes_org_isolation" on public.routes;
create policy "routes_org_isolation" on public.routes
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "explanations_org_isolation" on public.explanations;
create policy "explanations_org_isolation" on public.explanations
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "file_roles_org_isolation" on public.file_roles;
create policy "file_roles_org_isolation" on public.file_roles
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

drop policy if exists "insights_org_isolation" on public.insights;
create policy "insights_org_isolation" on public.insights
  for all
  to authenticated
  using (organization_id = (select public.requesting_org_id()))
  with check (organization_id = (select public.requesting_org_id()));

-- Grants: Both anon and authenticated have table access, but RLS ensures
-- that without a policy, no rows are returned. Only authenticated with matching org_id sees rows.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

