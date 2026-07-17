import { describe, expect, it } from "vitest";

import { isAllowedCollegeEmail } from "../features/auth/college-email";

describe("public entry point", () => {
  it("uses the shared college authentication policy", () => {
    expect(isAllowedCollegeEmail("user@cs.sjcetpalai.ac.in")).toBe(true);
  });
});
