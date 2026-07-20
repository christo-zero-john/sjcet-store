import { describe, expect, it } from "vitest";

import { getPaymentEnvironment } from "./environment";

function baseEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SITE_URL: "https://store.example",
    DODO_PAYMENTS_API_KEY: "secret_api_key_value",
    DODO_WEBHOOK_SECRET: "secret_webhook_value",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_DYNAMIC_PRODUCT_ID: "pwyw_product",
    PAYMENT_PROVIDER: "dodo",
    PAYMENT_HANDOFF_TTL_MINUTES: "30",
  };
}

describe("getPaymentEnvironment", () => {
  it("parses a fully configured environment", () => {
    const environment = getPaymentEnvironment(baseEnv());

    expect(environment.provider).toBe("dodo");
    expect(environment.siteUrl).toBe("https://store.example");
    expect(environment.handoffTtlMinutes).toBe(30);
    expect(environment.dodo.apiKey).toBe("secret_api_key_value");
    expect(environment.dodo.webhookSecret).toBe("secret_webhook_value");
    expect(environment.dodo.environment).toBe("test_mode");
    expect(environment.dodo.dynamicProductId).toBe("pwyw_product");
  });

  it("defaults the handoff TTL when unset", () => {
    const env = baseEnv();
    delete env.PAYMENT_HANDOFF_TTL_MINUTES;

    expect(getPaymentEnvironment(env).handoffTtlMinutes).toBe(30);
  });

  it.each([
    "DODO_PAYMENTS_API_KEY",
    "DODO_WEBHOOK_SECRET",
    "DODO_DYNAMIC_PRODUCT_ID",
    "NEXT_PUBLIC_SITE_URL",
  ])("throws a safe error when %s is missing", (missing) => {
    const env = baseEnv();
    delete env[missing];

    expect(() => getPaymentEnvironment(env)).toThrow(/payment environment/i);
  });

  it("never echoes secret values in the error message", () => {
    const env = baseEnv();
    delete env.DODO_PAYMENTS_API_KEY;
    env.DODO_WEBHOOK_SECRET = "super_secret_leak";

    try {
      getPaymentEnvironment(env);
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as Error).message).not.toContain("super_secret_leak");
    }
  });

  it("rejects an unknown payment provider", () => {
    const env = baseEnv();
    env.PAYMENT_PROVIDER = "stripe";

    expect(() => getPaymentEnvironment(env)).toThrow(/provider/i);
  });

  it("rejects an unknown dodo environment", () => {
    const env = baseEnv();
    env.DODO_PAYMENTS_ENVIRONMENT = "sandbox";

    expect(() => getPaymentEnvironment(env)).toThrow(/environment/i);
  });

  it("accepts the documented handoff TTL boundaries", () => {
    expect(
      getPaymentEnvironment({ ...baseEnv(), PAYMENT_HANDOFF_TTL_MINUTES: "5" })
        .handoffTtlMinutes,
    ).toBe(5);
    expect(
      getPaymentEnvironment({ ...baseEnv(), PAYMENT_HANDOFF_TTL_MINUTES: "120" })
        .handoffTtlMinutes,
    ).toBe(120);
  });

  it.each(["4", "121", "0", "-1", "abc", "30.5"])(
    "rejects an out-of-range handoff TTL %s",
    (value) => {
      expect(() =>
        getPaymentEnvironment({
          ...baseEnv(),
          PAYMENT_HANDOFF_TTL_MINUTES: value,
        }),
      ).toThrow(/handoff/i);
    },
  );
});
