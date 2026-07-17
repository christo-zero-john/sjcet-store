import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  getServerAuthorizedRoles,
  type AuthorizedRole,
} from "./configured-super-admin";

export type AppRole = AuthorizedRole;

export function canManageStore(roles: readonly AppRole[]): boolean {
  return roles.includes("store_manager") || roles.includes("super_admin");
}

export async function requireStoreOperator() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  let roles: AppRole[];
  try {
    roles = await getServerAuthorizedRoles(user);
  } catch {
    redirect(
      "/auth?error=Role%20authorization%20failed.%20Apply%20the%20latest%20database%20migration.",
    );
  }

  if (!canManageStore(roles)) {
    redirect("/auth?error=Store%20manager%20access%20is%20required.");
  }

  return { supabase, user, roles };
}
