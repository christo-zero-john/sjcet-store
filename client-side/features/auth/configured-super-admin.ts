import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type AuthorizedRole =
  | "student"
  | "store_manager"
  | "print_admin"
  | "super_admin";

export function parseConfiguredSuperAdminEmails(
  value: string | undefined,
): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((email) => email.trim().toLocaleLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isConfiguredSuperAdmin(
  email: string | undefined,
  configuredEmails: string | undefined,
): boolean {
  if (!email) return false;
  return parseConfiguredSuperAdminEmails(configuredEmails).includes(
    email.trim().toLocaleLowerCase(),
  );
}

export async function getServerAuthorizedRoles(user: {
  id: string;
  email?: string;
}): Promise<AuthorizedRole[]> {
  const configuredEmails = process.env.INITIAL_SUPER_ADMIN_EMAILS;
  const grantConfiguredSuperAdmin = isConfiguredSuperAdmin(
    user.email,
    configuredEmails,
  );
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("authorize_user_roles", {
    target_user_id: user.id,
    grant_configured_super_admin: grantConfiguredSuperAdmin,
  });

  if (error) {
    console.error("[auth] Server role authorization failed.", {
      code: error.code,
    });
    throw new Error("Server role authorization failed.", {
      cause: error,
    });
  }

  console.info("[auth] Server role authorization completed.", {
    configuredSuperAdmin: grantConfiguredSuperAdmin,
    roleCount: data?.length ?? 0,
  });
  return (data ?? []) as AuthorizedRole[];
}
