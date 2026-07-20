import { describe, expect, it } from "vitest";

import { buildHandoffUrl, createHandoffToken, hashHandoffToken } from "./handoff";

describe("createHandoffToken", () => {
  it("returns a base64url token of 32 random bytes", () => {
    const { rawToken } = createHandoffToken();
    const decoded = Buffer.from(rawToken, "base64url");
    expect(decoded).toHaveLength(32);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it("returns a 64-character lowercase SHA-256 hash", () => {
    const { rawToken, sha256 } = createHandoffToken();
    expect(sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(sha256).toBe(hashHandoffToken(rawToken));
  });

  it("produces unique tokens", () => {
    expect(createHandoffToken().rawToken).not.toBe(createHandoffToken().rawToken);
  });
});

describe("buildHandoffUrl", () => {
  it("encodes only the application handoff path", () => {
    const url = buildHandoffUrl("https://store.example", "abc_123");
    expect(url).toBe("https://store.example/pay/abc_123");
  });

  it("never contains an order id or provider url", () => {
    const url = buildHandoffUrl("https://store.example", "opaque-token");
    expect(url).not.toContain("checkout");
    expect(url).not.toContain("dodopayments");
  });
});
