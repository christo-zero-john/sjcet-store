import {
  getPaymentEnvironment,
  type PaymentEnvironment,
} from "./environment";
import { createDodoProvider } from "./providers/dodo";
import type { PaymentProvider } from "./contracts";

let cached: PaymentProvider | null = null;

const REGISTRY: Readonly<
  Record<PaymentEnvironment["provider"], (env: PaymentEnvironment) => PaymentProvider>
> = {
  dodo: (env) => createDodoProvider(env),
};

/**
 * Server-only provider registry. Unknown configuration fails closed. No client
 * component imports this module.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const environment = getPaymentEnvironment();
  const factory = REGISTRY[environment.provider];
  if (!factory) {
    throw new Error("The configured payment provider is not registered.");
  }
  cached = factory(environment);
  return cached;
}
