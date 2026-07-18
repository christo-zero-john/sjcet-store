import type { AuthorizedRole } from "./configured-super-admin";

export type RoleDestination =
  | "/dashboard"
  | "/store-manager/products"
  | "/super-admin";

export function destinationForRoles(
  roles: readonly AuthorizedRole[],
): RoleDestination {
  if (roles.includes("super_admin")) return "/super-admin";
  if (roles.includes("store_manager")) return "/store-manager/products";
  return "/dashboard";
}
