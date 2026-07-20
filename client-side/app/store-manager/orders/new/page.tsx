import { requireStoreOperator } from "../../../../features/auth/authorization";
import {
  cancelOnlineOrder,
  completeCashCounterSale,
  createOnlineCounterOrder,
  rotatePaymentHandoff,
  searchSellableVariants,
} from "../../../../features/orders/actions";
import { CounterSale } from "../../../../features/store-manager/counter-sale";
import type {
  CompleteCashCounterSaleInput,
  CreateOnlineCounterOrderInput,
} from "../../../../features/orders/contracts";

export const metadata = {
  title: "Counter sale",
};

async function searchAction(query: string) {
  "use server";
  return searchSellableVariants(query);
}

async function completeCashAction(input: CompleteCashCounterSaleInput) {
  "use server";
  return completeCashCounterSale(input);
}

async function createOnlineAction(input: CreateOnlineCounterOrderInput) {
  "use server";
  return createOnlineCounterOrder(input);
}

async function rotateHandoffAction(orderId: string) {
  "use server";
  return rotatePaymentHandoff(orderId);
}

// Keeps cancel wired for the online result flow.
export async function cancelAction(orderId: string) {
  "use server";
  return cancelOnlineOrder(orderId);
}

export default async function CounterSalePage() {
  await requireStoreOperator();

  return (
    <main className="counter-sale-page">
      <header className="counter-sale-header">
        <p className="eyebrow">Daily work</p>
        <h1>Counter sale</h1>
        <p>Search products, build a basket, and collect cash or online payment.</p>
      </header>

      <CounterSale
        actions={{
          search: searchAction,
          completeCash: completeCashAction,
          createOnline: createOnlineAction,
          rotateHandoff: rotateHandoffAction,
        }}
      />
    </main>
  );
}
