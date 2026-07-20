import { describe, expect, it } from "vitest";

import { destinationForRoles } from "./role-destination";

describe("role-aware destinations", () => {
  it("sends students and other non-manager roles to the customer dashboard", () => {
    expect(destinationForRoles(["student"])).toBe("/dashboard");
    expect(destinationForRoles(["print_admin"])).toBe("/dashboard");
    expect(destinationForRoles([])).toBe("/dashboard");
  });

  it("sends store managers to the product workspace", () => {
    expect(destinationForRoles(["student", "store_manager"])).toBe(
      "/store-manager/products",
    );
  });

  it("gives the super-admin workspace precedence for multi-role users", () => {
    expect(
      destinationForRoles(["student", "store_manager", "super_admin"]),
    ).toBe("/super-admin");
  });
});
