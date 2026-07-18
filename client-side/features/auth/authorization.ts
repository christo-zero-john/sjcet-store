import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  getServerAuthorizedRoles,
  type AuthorizedRole,
} from "./configured-super-admin";
import { destinationForRoles } from "./role-destination";

export type AppRole = AuthorizedRole;

export function canManageStore(roles: readonly AppRole[]): boolean {
  return roles.includes("store_manager") || roles.includes("super_admin");
}

export function canManageUsers(roles: readonly AppRole[]): boolean {
  return roles.includes("super_admin");
}

export const requireAuthenticatedUser = cache(async function requireAuthenticatedUser() {
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

  return { supabase, user, roles };
});

export async function requireStoreOperator() {
  const context = await requireAuthenticatedUser();

  if (!canManageStore(context.roles)) {
    redirect(
      "/dashboard?notice=Store%20manager%20access%20is%20required%20for%20that%20workspace.",
    );
  }

  return context;
}

export async function requireSuperAdmin() {
  const context = await requireAuthenticatedUser();

  if (!canManageUsers(context.roles)) {
    redirect(destinationForRoles(context.roles));
  }

  return context;
}

export async function requireStudentLanding() {
  const context = await requireAuthenticatedUser();
  const destination = destinationForRoles(context.roles);

  if (destination !== "/dashboard") {
    redirect(destination);
  }

  return context;
}

export async function requireRoleDestination() {
  const context = await requireAuthenticatedUser();
  return {
    ...context,
    destination: destinationForRoles(context.roles),
  };
}
