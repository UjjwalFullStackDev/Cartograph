-- Cartograph Phase 2 Seed Data
-- Seeds projects and analyses across distinct organizations to verify RLS isolation

-- 1. Seed Organizations
insert into public.organizations (id, name, slug)
values
  ('org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'Ujjwal''s Organization', 'ujjwal-s-organization-1793639209093209808'),
  ('org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH', 'Ujjwal Tyagi', 'ujjwal-tyagi-1793641317075811296'),
  ('org_sample_secondary_team', 'Secondary Alpha Team', 'secondary-alpha-team')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

-- 2. Seed Projects
insert into public.projects (id, organization_id, name, repository_url, default_branch)
values
  ('11111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'cartograph', 'https://github.com/ujjwal/cartograph', 'main'),
  ('22222222-2222-2222-2222-222222222222', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'next-enterprise', 'https://github.com/blunck-se/next-enterprise', 'main'),
  ('33333333-3333-3333-3333-333333333333', 'org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH', 'svelte-core', 'https://github.com/sveltejs/svelte', 'main'),
  ('44444444-4444-4444-4444-444444444444', 'org_sample_secondary_team', 'react-flow-demo', 'https://github.com/xyflow/xyflow', 'main')
on conflict (id) do update set
  organization_id = excluded.organization_id,
  name = excluded.name,
  repository_url = excluded.repository_url;

-- 3. Seed Analyses
insert into public.analyses (id, organization_id, project_id, commit_hash, status, stage, file_count, edge_count, error_message, created_at, updated_at)
values
  (
    'aaaa1111-1111-1111-1111-111111111111',
    'org_3LYm7gniGSGwJBuN9os6wsuhsVD',
    '11111111-1111-1111-1111-111111111111',
    '977eeae',
    'completed',
    'ready',
    48,
    132,
    null,
    now() - interval '2 hours',
    now() - interval '2 hours'
  ),
  (
    'aaaa2222-2222-2222-2222-222222222222',
    'org_3LYm7gniGSGwJBuN9os6wsuhsVD',
    '11111111-1111-1111-1111-111111111111',
    'bf11586',
    'parsing',
    'traversing_imports',
    18,
    24,
    null,
    now() - interval '25 minutes',
    now() - interval '25 minutes'
  ),
  (
    'aaaa3333-3333-3333-3333-333333333333',
    'org_3LYm7gniGSGwJBuN9os6wsuhsVD',
    '22222222-2222-2222-2222-222222222222',
    'f4e8b10',
    'failed',
    'import_resolution',
    0,
    0,
    'Unresolved cyclic barrel re-export on @lib/index.ts',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    'bbbb1111-1111-1111-1111-111111111111',
    'org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH',
    '33333333-3333-3333-3333-333333333333',
    'c0ffee1',
    'completed',
    'ready',
    342,
    910,
    null,
    now() - interval '3 hours',
    now() - interval '3 hours'
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  project_id = excluded.project_id,
  status = excluded.status,
  stage = excluded.stage;

-- 4. Seed Files
insert into public.files (id, organization_id, analysis_id, path, folder, line_count, hash, fan_in, fan_out)
values
  ('f1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'app/page.tsx', 'app', 185, 'hash1', 2, 8),
  ('f2222222-2222-2222-2222-222222222222', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'lib/db.ts', 'lib', 32, 'hash2', 5, 2),
  ('f3333333-3333-3333-3333-333333333333', 'org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH', 'bbbb1111-1111-1111-1111-111111111111', 'src/runtime/index.ts', 'src/runtime', 512, 'hash3', 14, 12)
on conflict (id) do nothing;

-- 5. Seed Edges
insert into public.edges (id, organization_id, analysis_id, source_file_id, target_file_id, target_path, kind, is_resolved)
values
  ('e1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222', '@/lib/db', 'import', true),
  ('e2222222-2222-2222-2222-222222222222', 'org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH', 'bbbb1111-1111-1111-1111-111111111111', 'f3333333-3333-3333-3333-333333333333', null, 'svelte/internal', 'import', true)
on conflict (id) do nothing;

-- 6. Seed Routes
insert into public.routes (id, organization_id, analysis_id, file_id, method, pattern)
values
  ('c1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'GET', '/')
on conflict (id) do nothing;

-- 7. Seed Explanations
insert into public.explanations (id, organization_id, analysis_id, file_id, content, model)
values
  ('d1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222', 'Provides authenticated Supabase client carrying Clerk JWT tokens with RLS isolation.', 'o3-mini')
on conflict (id) do nothing;

-- 8. Seed File Roles
insert into public.file_roles (id, organization_id, analysis_id, file_id, role, confidence)
values
  ('b1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'page', 1.00),
  ('b2222222-2222-2222-2222-222222222222', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222', 'utility', 0.95)
on conflict (id) do nothing;

-- 9. Seed Insights
insert into public.insights (id, organization_id, analysis_id, kind, data)
values
  ('a1111111-1111-1111-1111-111111111111', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', 'aaaa1111-1111-1111-1111-111111111111', 'coverage', '{"parsed": 48, "skipped": 0, "unresolved": 0}'::jsonb)
on conflict (id) do nothing;
