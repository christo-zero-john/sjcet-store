import { describe, expect, it } from "vitest";

import { canManageStore } from "./authorization";

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
});
