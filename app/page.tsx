import { Suspense } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createDbClient } from "@/lib/db";

interface ProjectRelation {
  name: string;
  repository_url: string;
}

interface AnalysisRow {
  id: string;
  project_id: string;
  commit_hash: string | null;
  status: "pending" | "fetching" | "selecting" | "parsing" | "completed" | "failed" | "stale";
  stage: string | null;
  error_message: string | null;
  file_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
  projects: ProjectRelation | ProjectRelation[] | null;
}

async function getAnalyses(): Promise<{ analyses: AnalysisRow[]; error: string | null }> {
  try {
    const db = await createDbClient();
    // No organization filter in application code. RLS policies enforce isolation.
    const { data, error } = await db
      .from("analyses")
      .select(`
        id,
        project_id,
        commit_hash,
        status,
        stage,
        error_message,
        file_count,
        edge_count,
        created_at,
        updated_at,
        projects (
          name,
          repository_url
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return { analyses: [], error: error.message };
    }

    return { analyses: (data as unknown as AnalysisRow[]) ?? [], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown database query failure";
    return { analyses: [], error: msg };
  }
}

function StatusBadge({ status }: { status: AnalysisRow["status"] }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          completed
        </span>
      );
    case "parsing":
    case "fetching":
    case "selecting":
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {status}
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-rose-600 dark:text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          failed
        </span>
      );
    case "stale":
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          stale
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          {status}
        </span>
      );
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().replace("T", " ").substring(0, 16);
  } catch {
    return dateStr;
  }
}

function getProjectInfo(projects: AnalysisRow["projects"]): ProjectRelation {
  if (Array.isArray(projects)) {
    return projects[0] || { name: "unknown", repository_url: "" };
  }
  return projects || { name: "unknown", repository_url: "" };
}

async function AnalysesDashboard() {
  const { analyses, error } = await getAnalyses();

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="font-mono text-xs text-rose-500 dark:text-rose-400">
          Database query error
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">{error}</p>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
          No analyses recorded
        </p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          This team has not run an analysis yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <th className="px-3 py-2 font-medium">REPOSITORY</th>
            <th className="px-3 py-2 font-medium">COMMIT</th>
            <th className="px-3 py-2 font-medium">STATUS</th>
            <th className="px-3 py-2 font-medium">STAGE</th>
            <th className="px-3 py-2 font-medium text-right">FILES</th>
            <th className="px-3 py-2 font-medium text-right">EDGES</th>
            <th className="px-3 py-2 font-medium text-right">RECORDED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {analyses.map((analysis) => {
            const project = getProjectInfo(analysis.projects);
            return (
              <tr
                key={analysis.id}
                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30"
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {project.name}
                  </div>
                  {project.repository_url && (
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {project.repository_url.replace("https://github.com/", "")}
                    </div>
                  )}
                  {analysis.error_message && (
                    <div className="mt-1 text-[10px] text-rose-500 dark:text-rose-400">
                      {analysis.error_message}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {analysis.commit_hash || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={analysis.status} />
                </td>
                <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">
                  {analysis.stage || "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-700 dark:text-zinc-300">
                  {analysis.file_count.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-700 dark:text-zinc-300">
                  {analysis.edge_count.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-400 dark:text-zinc-500">
                  {formatDate(analysis.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
        loading analyses...
      </span>
    </div>
  );
}

async function OrganizationDetails() {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  let orgName: string | null = null;
  const activeOrgId: string | null = orgId ?? null;

  if (userId) {
    const client = await clerkClient();

    if (orgId) {
      try {
        const org = await client.organizations.getOrganization({
          organizationId: orgId,
        });
        orgName = org.name;
      } catch {
        orgName = orgSlug || orgId;
      }
    } else {
      const memberships = await client.users.getOrganizationMembershipList({
        userId,
        limit: 1,
      });

      if (memberships.data.length > 0) {
        orgName = memberships.data[0].organization.name;
      }
    }
  }

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-[11px] dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
        Active Organization
      </p>
      <dl className="mt-2 space-y-1 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
        <div>
          <dt className="inline text-zinc-400">Name: </dt>
          <dd className="inline font-semibold text-zinc-900 dark:text-zinc-100">
            {orgName || "None"}
          </dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">ID: </dt>
          <dd className="inline text-zinc-700 dark:text-zinc-300">
            {activeOrgId || "None"}
          </dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Slug: </dt>
          <dd className="inline text-zinc-700 dark:text-zinc-300">
            {orgSlug || "N/A"}
          </dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Role: </dt>
          <dd className="inline text-zinc-700 dark:text-zinc-300">
            {orgRole || "member"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

async function StatusBar() {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  let orgName: string | null = null;
  const activeOrgId: string | null = orgId ?? null;

  if (userId) {
    const client = await clerkClient();

    if (orgId) {
      try {
        const org = await client.organizations.getOrganization({
          organizationId: orgId,
        });
        orgName = org.name;
      } catch {
        orgName = orgSlug || orgId;
      }
    } else {
      const memberships = await client.users.getOrganizationMembershipList({
        userId,
        limit: 1,
      });

      if (memberships.data.length > 0) {
        orgName = memberships.data[0].organization.name;
      }
    }
  }

  return (
    <footer className="flex h-7 items-center justify-between border-t border-zinc-200 px-3 text-[11px] font-mono text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span>team:</span>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {orgName || "Unassigned"}
        </span>
        {activeOrgId && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            ({activeOrgId})
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
        {orgRole && <span>role: {orgRole}</span>}
        <span>auth: token verified</span>
      </div>
    </footer>
  );
}

function OrganizationFallback() {
  return (
    <div className="h-24 rounded border border-zinc-200 bg-zinc-50 p-3 animate-pulse dark:border-zinc-800 dark:bg-zinc-900/40" />
  );
}

function StatusBarFallback() {
  return (
    <footer className="flex h-7 items-center justify-between border-t border-zinc-200 px-3 text-[11px] font-mono text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
      <span>loading session...</span>
    </footer>
  );
}

export default function HomePage() {
  return (
    <main className="flex flex-1 overflow-hidden bg-[var(--background)]">
      {/* Central Analyses Dashboard */}
      <section className="flex flex-1 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex h-8 items-center justify-between border-b border-zinc-200 px-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            workspace / analyses
          </span>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            press / to search
          </span>
        </div>

        <Suspense fallback={<DashboardFallback />}>
          <AnalysesDashboard />
        </Suspense>

        {/* Server-Rendered Status Bar */}
        <Suspense fallback={<StatusBarFallback />}>
          <StatusBar />
        </Suspense>
      </section>

      {/* Detail & Workspace Info Rail */}
      <aside className="hidden w-80 flex-col md:flex">
        <div className="flex h-8 items-center border-b border-zinc-200 px-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            details / team
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <Suspense fallback={<OrganizationFallback />}>
            <OrganizationDetails />
          </Suspense>
          <div className="mt-4 flex-1 rounded border border-dashed border-zinc-200 p-3 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            <p className="font-mono text-[10px]">
              Analyses list is filtered at database level by organization claim on the auth token.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
