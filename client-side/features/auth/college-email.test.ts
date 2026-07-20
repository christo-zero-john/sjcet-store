import { describe, expect, it } from "vitest";

import { isAllowedCollegeEmail } from "./college-email";

describe("college email policy", () => {
  it.each([
    "student@cs.sjcetpalai.ac.in",
    "student@2026.cse.sjcetpalai.ac.in",
    "FACULTY@ME.SJCETPALAI.AC.IN",
  ])("accepts %s", (email) => {
    expect(isAllowedCollegeEmail(email)).toBe(true);
  });

  it.each([
    "student@sjcetpalai.ac.in",
    "student@gmail.com",
    "student@fake-sjcetpalai.ac.in",
    "student@sjcetpalai.ac.in.example.com",
    "not-an-email",
  ])("rejects %s", (email) => {
    expect(isAllowedCollegeEmail(email)).toBe(false);
  });
});
