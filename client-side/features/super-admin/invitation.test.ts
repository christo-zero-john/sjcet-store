import { describe, expect, it } from "vitest";

import {
  managerInviteRedirect,
  normalizeManagerEmail,
} from "./invitation";

describe("store-manager invitations", () => {
  it("normalizes valid college addresses", () => {
    expect(
      normalizeManagerEmail("  Manager@Store.SJCETPALAI.AC.IN "),
    ).toBe("manager@store.sjcetpalai.ac.in");
  });

  it("rejects addresses without a college subdomain", () => {
    expect(() =>
      normalizeManagerEmail("manager@sjcetpalai.ac.in"),
    ).toThrow("approved SJCET college email");
    expect(() => normalizeManagerEmail("manager@gmail.com")).toThrow(
      "approved SJCET college email",
    );
  });

  it("builds the shared confirmation destination", () => {
    expect(managerInviteRedirect("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/confirm",
    );
  });
});
