import { describe, expect, it, vi } from "vitest";

import {
  getServerAuthorizedRoles,
  isConfiguredSuperAdmin,
  parseConfiguredSuperAdminEmails,
} from "./configured-super-admin";

const rpc = vi.fn();

vi.mock("../../lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

describe("configured super admins", () => {
  it("parses a comma-separated list, trimming and normalizing emails", () => {
    expect(
      parseConfiguredSuperAdminEmails(
        " Admin@One.SJCETPALAI.ac.in,second@two.sjcetpalai.ac.in ,, ",
      ),
    ).toEqual([
      "admin@one.sjcetpalai.ac.in",
      "second@two.sjcetpalai.ac.in",
    ]);
  });

  it("deduplicates configured addresses", () => {
    expect(
      parseConfiguredSuperAdminEmails(
        "admin@store.sjcetpalai.ac.in,ADMIN@store.sjcetpalai.ac.in",
      ),
    ).toEqual(["admin@store.sjcetpalai.ac.in"]);
  });

  it("matches configured addresses case-insensitively", () => {
    expect(
      isConfiguredSuperAdmin(
        "SUPERADMIN@store.sjcetpalai.ac.in",
        "other@cse.sjcetpalai.ac.in, superadmin@store.sjcetpalai.ac.in",
      ),
    ).toBe(true);
  });

  it("rejects absent and unconfigured addresses", () => {
    expect(isConfiguredSuperAdmin(undefined, "admin@store.sjcetpalai.ac.in")).toBe(
      false,
    );
    expect(
      isConfiguredSuperAdmin(
        "student@store.sjcetpalai.ac.in",
        "admin@store.sjcetpalai.ac.in",
      ),
    ).toBe(false);
  });
});

describe("server role authorization", () => {
  it("uses one service contract to synchronize and return roles", async () => {
    process.env.INITIAL_SUPER_ADMIN_EMAILS =
      "superadmin@store.sjcetpalai.ac.in";
    rpc.mockResolvedValueOnce({
      data: ["student", "super_admin"],
      error: null,
    });

    await expect(
      getServerAuthorizedRoles({
        id: "user-1",
        email: "superadmin@store.sjcetpalai.ac.in",
      }),
    ).resolves.toEqual(["student", "super_admin"]);
    expect(rpc).toHaveBeenCalledWith("authorize_user_roles", {
      target_user_id: "user-1",
      grant_configured_super_admin: true,
    });
  });

  it("does not request promotion for an unlisted account", async () => {
    process.env.INITIAL_SUPER_ADMIN_EMAILS =
      "superadmin@store.sjcetpalai.ac.in";
    rpc.mockResolvedValueOnce({ data: ["student"], error: null });

    await getServerAuthorizedRoles({
      id: "user-2",
      email: "student@store.sjcetpalai.ac.in",
    });

    expect(rpc).toHaveBeenCalledWith("authorize_user_roles", {
      target_user_id: "user-2",
      grant_configured_super_admin: false,
    });
  });
});
