import { describe, expect, it } from "vitest";

import { safeAuthReturnPath } from "./return-path";

describe("safeAuthReturnPath", () => {
  it("accepts only local payment paths", () => {
    expect(safeAuthReturnPath("/pay/abc_123")).toBe("/pay/abc_123");
    expect(safeAuthReturnPath("/pay/abc?returned=1")).toBe(
      "/pay/abc?returned=1",
    );
  });

  it.each([
    "https://evil.example/pay/x",
    "//evil.example/pay/x",
    "/dashboard",
    "/store-manager/orders",
    "/pay\\evil",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    "/paymalicious",
    "/pay",
  ])("rejects %s", (value) => {
    expect(safeAuthReturnPath(value)).toBeNull();
  });
});
