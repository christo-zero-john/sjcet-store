type PublicSupabaseEnvironment = Readonly<Record<string, string | undefined>>;

export function hasSupabasePublicConfig(
  environment: PublicSupabaseEnvironment,
): boolean {
  return Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getSupabasePublicConfig(
  environment: PublicSupabaseEnvironment = process.env,
) {
  if (!hasSupabasePublicConfig(environment)) {
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key.",
    );
  }

  return {
    url: environment.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
