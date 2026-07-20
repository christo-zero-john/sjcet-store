export type PaymentEnvironment = Readonly<{
  provider: "dodo";
  siteUrl: string;
  handoffTtlMinutes: number;
  dodo: Readonly<{
    apiKey: string;
    webhookSecret: string;
    environment: "test_mode" | "live_mode";
    dynamicProductId: string;
  }>;
}>;

const DEFAULT_HANDOFF_TTL_MINUTES = 30;
const MIN_HANDOFF_TTL_MINUTES = 5;
const MAX_HANDOFF_TTL_MINUTES = 120;

type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Configuration error that never carries an environment value in its message,
 * so a misconfiguration cannot leak secrets into logs or responses.
 */
class PaymentEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentEnvironmentError";
  }
}

function requireValue(env: EnvSource, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new PaymentEnvironmentError(
      `Payment environment is misconfigured: ${name} is required.`,
    );
  }
  return value;
}

function parseHandoffTtl(env: EnvSource): number {
  const raw = env.PAYMENT_HANDOFF_TTL_MINUTES?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_HANDOFF_TTL_MINUTES;
  }

  if (!/^\d+$/u.test(raw)) {
    throw new PaymentEnvironmentError(
      "Payment environment is misconfigured: PAYMENT_HANDOFF_TTL_MINUTES " +
        `handoff TTL must be a whole number of minutes between ${MIN_HANDOFF_TTL_MINUTES} and ${MAX_HANDOFF_TTL_MINUTES}.`,
    );
  }

  const minutes = Number.parseInt(raw, 10);
  if (minutes < MIN_HANDOFF_TTL_MINUTES || minutes > MAX_HANDOFF_TTL_MINUTES) {
    throw new PaymentEnvironmentError(
      "Payment environment is misconfigured: PAYMENT_HANDOFF_TTL_MINUTES " +
        `handoff TTL must be between ${MIN_HANDOFF_TTL_MINUTES} and ${MAX_HANDOFF_TTL_MINUTES} minutes.`,
    );
  }

  return minutes;
}

function parseProvider(env: EnvSource): "dodo" {
  const provider = env.PAYMENT_PROVIDER?.trim() ?? "dodo";
  if (provider !== "dodo") {
    throw new PaymentEnvironmentError(
      "Payment environment is misconfigured: PAYMENT_PROVIDER selects an " +
        "unknown payment provider.",
    );
  }
  return provider;
}

function parseDodoEnvironment(env: EnvSource): "test_mode" | "live_mode" {
  const value = env.DODO_PAYMENTS_ENVIRONMENT?.trim() ?? "test_mode";
  if (value !== "test_mode" && value !== "live_mode") {
    throw new PaymentEnvironmentError(
      "Payment environment is misconfigured: DODO_PAYMENTS_ENVIRONMENT must " +
        "be test_mode or live_mode.",
    );
  }
  return value;
}

/**
 * Server-only parser for the provider-neutral payment configuration. Raw
 * values are never returned to client bundles and are never included in errors.
 */
export function getPaymentEnvironment(
  env: EnvSource = process.env,
): PaymentEnvironment {
  const provider = parseProvider(env);
  const siteUrl = requireValue(env, "NEXT_PUBLIC_SITE_URL");
  const handoffTtlMinutes = parseHandoffTtl(env);

  return Object.freeze({
    provider,
    siteUrl,
    handoffTtlMinutes,
    dodo: Object.freeze({
      apiKey: requireValue(env, "DODO_PAYMENTS_API_KEY"),
      webhookSecret: requireValue(env, "DODO_WEBHOOK_SECRET"),
      environment: parseDodoEnvironment(env),
      dynamicProductId: requireValue(env, "DODO_DYNAMIC_PRODUCT_ID"),
    }),
  });
}
