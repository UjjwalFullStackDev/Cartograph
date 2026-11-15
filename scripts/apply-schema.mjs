import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [k, ...v] = trimmed.split("=");
      env[k.trim()] = v.join("=").trim();
    }
  }
  return env;
}

async function run() {
  const env = loadEnv();
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  const projectRef = url.hostname.split(".")[0];
  const password = env.PASSWORD;

  if (!password) {
    throw new Error("PASSWORD not found in .env.local");
  }

  // Direct connection to Supabase Postgres
  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  console.log(`Connecting to db.${projectRef}.supabase.co:5432...`);

  const caCertPath = process.env.SUPABASE_CA_CERT_PATH || path.resolve(process.cwd(), "supabase/prod-ca-2021.crt");
  const ca = process.env.SUPABASE_SSL_CA || (fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath, "utf8") : undefined);

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ca,
    },
  });

  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  try {
    // 1. Run Migration
    const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261102000000_phase_02_schema.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    console.log("Applying migration 20261102000000_phase_02_schema.sql...");
    await client.query(migrationSql);
    console.log("Migration applied successfully.");

    // 2. Run Seed
    const seedPath = path.resolve(process.cwd(), "supabase/seed.sql");
    const seedSql = fs.readFileSync(seedPath, "utf8");
    console.log("Applying seed.sql...");
    await client.query(seedSql);
    console.log("Seed data applied successfully.");

    // 3. Verify all 8 tables exist and have RLS enabled
    console.log("\nVerifying RLS status across all tables:");
    const expectedTables = [
      "projects",
      "analyses",
      "files",
      "edges",
      "routes",
      "explanations",
      "file_roles",
      "insights",
    ];

    const rlsCheckQuery = `
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and relname = any($1);
    `;

    const res = await client.query(rlsCheckQuery, [expectedTables]);
    const checked = new Set();
    for (const row of res.rows) {
      checked.add(row.relname);
      const isRls = row.relrowsecurity;
      const isForced = row.relforcerowsecurity;
      console.log(`- Table ${row.relname}: RLS=${isRls}, FORCED=${isForced}`);
      if (!isRls) {
        throw new Error(`Table ${row.relname} does NOT have row level security enabled!`);
      }
    }

    for (const t of expectedTables) {
      if (!checked.has(t)) {
        throw new Error(`Table ${t} was not found in schema!`);
      }
    }
    console.log(`All ${expectedTables.length} tables verified with Row Level Security enabled!`);

    // 4. Test RLS isolation using Clerk org claim simulation
    console.log("\nVerifying RLS isolation with simulated token claims:");

    // Org 1 test
    await client.query("begin");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.org_id', 'org_3LYm7gniGSGwJBuN9os6wsuhsVD', true)");
    const org1Rows = await client.query("select id, organization_id, commit_hash, status from analyses");
    console.log(`Org 1 (Ujjwal's Org) visible analyses: ${org1Rows.rows.length}`);
    for (const row of org1Rows.rows) {
      console.log(`  - commit: ${row.commit_hash}, status: ${row.status}, org: ${row.organization_id}`);
      if (row.organization_id !== "org_3LYm7gniGSGwJBuN9os6wsuhsVD") {
        throw new Error(`RLS LEAK! Org 1 saw row from ${row.organization_id}`);
      }
    }
    await client.query("rollback");

    // Org 2 test
    await client.query("begin");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.org_id', 'org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH', true)");
    const org2Rows = await client.query("select id, organization_id, commit_hash, status from analyses");
    console.log(`Org 2 (Ujjwal Tyagi) visible analyses: ${org2Rows.rows.length}`);
    for (const row of org2Rows.rows) {
      console.log(`  - commit: ${row.commit_hash}, status: ${row.status}, org: ${row.organization_id}`);
      if (row.organization_id !== "org_3LYqOYzWlJTS1Gv0TVl2JrQU1qH") {
        throw new Error(`RLS LEAK! Org 2 saw row from ${row.organization_id}`);
      }
    }
    await client.query("rollback");

    // Org 3 (empty team) test
    await client.query("begin");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.org_id', 'org_brand_new_empty_team', true)");
    const org3Rows = await client.query("select id from analyses");
    console.log(`Org 3 (Brand new team) visible analyses: ${org3Rows.rows.length} (expected 0)`);
    if (org3Rows.rows.length !== 0) {
      throw new Error(`Expected 0 analyses for new team, got ${org3Rows.rows.length}`);
    }
    await client.query("rollback");

    console.log("\nRLS verification passed with 100% isolation across organizations!");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});

