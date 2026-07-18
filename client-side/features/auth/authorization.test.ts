import { describe, expect, it } from "vitest";

import { canManageStore, canManageUsers } from "./authorization";

describe("store authorization", () => {
  it.each(["store_manager", "super_admin"] as const)(
    "allows %s",
    (role) => {
      expect(canManageStore([role])).toBe(true);
    },
  );

  it.each([[["student"]], [["print_admin"]], [[]]] as const)(
    "denies non-store roles",
    (roles) => {
      expect(canManageStore([...roles])).toBe(false);
    },
  );

  it("restricts user access management to super admins", () => {
    expect(canManageUsers(["super_admin"])).toBe(true);
    expect(canManageUsers(["store_manager"])).toBe(false);
    expect(canManageUsers(["student"])).toBe(false);
  });
});
