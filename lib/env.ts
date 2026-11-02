/**
 * Server and client environment variable configuration.
 * Fails loudly at startup if any required environment variable is missing.
 */

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[Startup Error] Missing required environment variable: ${key}. Check your .env.local file.`
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: getRequiredEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  CLERK_SECRET_KEY: getRequiredEnv("CLERK_SECRET_KEY"),
  NEXT_PUBLIC_SUPABASE_URL: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (() => {
      throw new Error(
        `[Startup Error] Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.`
      );
    })(),
};

