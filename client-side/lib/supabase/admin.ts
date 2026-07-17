import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./config";

export function createSupabaseAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required to synchronize configured super admins.",
    );
  }

  const { url } = getSupabasePublicConfig();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
