import { Suspense } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";

async function OrganizationDetails() {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  let orgName: string | null = null;
  let activeOrgId: string | null = orgId ?? null;

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
        const firstMembership = memberships.data[0];
        activeOrgId = firstMembership.organization.id;
        orgName = firstMembership.organization.name;
      } else {
        const user = await client.users.getUser(userId);
        const name = user.firstName
          ? `${user.firstName}'s Team`
          : user.username
          ? `${user.username}'s Team`
          : "Personal Team";
        const createdOrg = await client.organizations.createOrganization({
          name,
          createdBy: userId,
        });
        activeOrgId = createdOrg.id;
        orgName = createdOrg.name;
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
  let activeOrgId: string | null = orgId ?? null;

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
        activeOrgId = memberships.data[0].organization.id;
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
      {/* Central Canvas Shell */}
      <section className="flex flex-1 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex h-8 items-center justify-between border-b border-zinc-200 px-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            workspace / graph
          </span>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            press / to search
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Dependency canvas ready
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              Repository parser will mount nodes and edges here in upcoming phases.
            </p>
          </div>
        </div>

        {/* Server-Rendered Status Bar */}
        <Suspense fallback={<StatusBarFallback />}>
          <StatusBar />
        </Suspense>
      </section>

      {/* Detail & Query Panel Shell */}
      <aside className="hidden w-80 flex-col md:flex">
        <div className="flex h-8 items-center border-b border-zinc-200 px-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            details / query
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <Suspense fallback={<OrganizationFallback />}>
            <OrganizationDetails />
          </Suspense>
          <div className="mt-4 flex-1 rounded border border-dashed border-zinc-200 p-3 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            <p className="font-mono text-[10px]">
              File inspector, fan-in/fan-out arithmetic, and agent query panel will populate this space.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
