"use client";

import { useMemo, useState } from "react";

import { formatPaise } from "../../lib/money/paise";
import {
  addBasketLine,
  basketTotalPaise,
  collectedProgress,
  removeBasketLine,
  setBasketQuantity,
  toCounterOrderItems,
  toggleCollected,
} from "../orders/basket";
import type {
  BasketLine,
  CashReceipt,
  CompleteCashCounterSaleInput,
  CreateOnlineCounterOrderInput,
  OnlineOrderResult,
  OrderResult,
  PaymentMethod,
  SellableVariant,
} from "../orders/contracts";
import { OnlineOrderResultView } from "./online-order-result";

export type CounterSaleActions = Readonly<{
  search: (query: string) => Promise<OrderResult<readonly SellableVariant[]>>;
  completeCash: (
    input: CompleteCashCounterSaleInput,
  ) => Promise<OrderResult<CashReceipt>>;
  createOnline: (
    input: CreateOnlineCounterOrderInput,
  ) => Promise<OrderResult<OnlineOrderResult>>;
  rotateHandoff: (orderId: string) => Promise<OrderResult<OnlineOrderResult>>;
}>;

// -- Pure, testable helpers -------------------------------------------------

export function isVariantAddable(variant: SellableVariant): boolean {
  return variant.availableStock > 0;
}

export function parseCashRupeesToPaise(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/u.test(trimmed)) return null;
  const paise = Math.round(Number.parseFloat(trimmed) * 100);
  return Number.isSafeInteger(paise) && paise >= 0 ? paise : null;
}

export function cashChangeDuePaise(
  cashInput: string,
  totalPaise: number,
): number | null {
  const received = parseCashRupeesToPaise(cashInput);
  if (received === null || received < totalPaise) return null;
  return received - totalPaise;
}

export function collectedAnnouncement(lines: readonly BasketLine[]): string {
  const { collected, total } = collectedProgress(lines);
  return `${collected} of ${total} items collected`;
}

export function hasUncollectedLines(lines: readonly BasketLine[]): boolean {
  return lines.some((line) => !line.collected);
}

export function canRotateHandoff(status: string): boolean {
  return status === "awaiting_payment";
}

// -- Component --------------------------------------------------------------

type Feedback = { code: string; message: string } | null;

export function CounterSale({ actions }: { actions: CounterSaleActions }) {
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [lines, setLines] = useState<readonly BasketLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SellableVariant[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Feedback>(null);
  const [online, setOnline] = useState<OnlineOrderResult | null>(null);
  const [cash, setCash] = useState<CashReceipt | null>(null);
  const [statusLabel, setStatusLabel] = useState("awaiting payment");

  const total = useMemo(() => basketTotalPaise(lines), [lines]);
  const progress = collectedAnnouncement(lines);
  const locked = online !== null || cash !== null;
  const checkoutDisabled = lines.length === 0 || submitting || locked;

  function addVariant(variant: SellableVariant) {
    setError(null);
    try {
      setLines((current) => addBasketLine(current, variant));
    } catch (caught) {
      setError({
        code: "INSUFFICIENT_STOCK",
        message: caught instanceof Error ? caught.message : "Not enough stock.",
      });
    }
  }

  function changeQuantity(variantId: string, value: number) {
    setError(null);
    try {
      setLines((current) => setBasketQuantity(current, variantId, value));
    } catch (caught) {
      setError({
        code: "INVALID_QUANTITY",
        message: caught instanceof Error ? caught.message : "Invalid quantity.",
      });
    }
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    const outcome = await actions.search(query);
    setSearching(false);
    if (outcome.ok) {
      setResults(outcome.data);
    } else {
      setError({ code: outcome.code, message: outcome.message });
    }
  }

  async function submit() {
    if (checkoutDisabled) return;
    setSubmitting(true);
    setError(null);
    const items = toCounterOrderItems(lines);

    if (method === "cash") {
      const cashReceivedPaise = parseCashRupeesToPaise(cashInput);
      if (cashReceivedPaise === null || cashReceivedPaise < total) {
        setSubmitting(false);
        setError({
          code: "INVALID_QUANTITY",
          message: "Enter cash received of at least the order total.",
        });
        return;
      }
      const outcome = await actions.completeCash({
        items,
        cashReceivedPaise,
        operationId,
      });
      setSubmitting(false);
      if (outcome.ok) setCash(outcome.data);
      else setError({ code: outcome.code, message: outcome.message });
      return;
    }

    const outcome = await actions.createOnline({ items, operationId });
    setSubmitting(false);
    if (outcome.ok) {
      setOnline(outcome.data);
      setStatusLabel("awaiting payment");
    } else {
      setError({ code: outcome.code, message: outcome.message });
    }
  }

  async function rotate() {
    if (!online) return;
    setSubmitting(true);
    const outcome = await actions.rotateHandoff(online.order.id);
    setSubmitting(false);
    if (outcome.ok) setOnline(outcome.data);
    else setError({ code: outcome.code, message: outcome.message });
  }

  function startNewSale() {
    setOperationId(crypto.randomUUID());
    setLines([]);
    setMethod("cash");
    setCashInput("");
    setQuery("");
    setResults([]);
    setOnline(null);
    setCash(null);
    setError(null);
  }

  if (online) {
    return (
      <OnlineOrderResultView
        result={online}
        statusLabel={statusLabel}
        canRotate={canRotateHandoff(online.order.status)}
        pending={submitting}
        onRotate={rotate}
        onRefresh={() => setStatusLabel("awaiting payment")}
        onCancel={startNewSale}
        onNewSale={startNewSale}
      />
    );
  }

  if (cash) {
    return (
      <section className="counter-cash-result" aria-labelledby="cash-result-title">
        <h2 id="cash-result-title">Order #{cash.order.orderNumber} paid</h2>
        <p>Cash received: {formatPaise(cash.cashReceivedPaise)}</p>
        <p className="counter-change">Change due: {formatPaise(cash.changeDuePaise)}</p>
        <div className="counter-cash-actions">
          <a href={`/store-manager/orders/${cash.order.id}/bill`}>Print bill</a>
          <button type="button" onClick={startNewSale}>
            Start another sale
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="counter-sale">
      <section className="counter-search" aria-labelledby="counter-search-title">
        <h2 id="counter-search-title">Find products</h2>
        <form onSubmit={runSearch} role="search">
          <label>
            Search by name, SKU, barcode, or variant
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Gel pen, PEN-BLUE, 890…"
              maxLength={100}
            />
          </label>
          <button type="submit" disabled={searching}>
            Search
          </button>
        </form>

        <ul className="counter-results">
          {results.map((variant) => (
            <li key={variant.variantId}>
              <div>
                <strong>{variant.productName}</strong> — {variant.variantDescription}
                <span className="counter-sku">{variant.sku}</span>
                <span className="counter-price">{formatPaise(variant.unitPricePaise)}</span>
                <span className="counter-stock">
                  {variant.availableStock} available
                </span>
              </div>
              <button
                type="button"
                onClick={() => addVariant(variant)}
                disabled={!isVariantAddable(variant)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="counter-basket" aria-labelledby="counter-basket-title">
        <h2 id="counter-basket-title">Basket</h2>

        {error ? (
          <p className="notice is-error" role="alert">
            {error.message}
          </p>
        ) : null}

        <ul>
          {lines.map((line) => (
            <li
              key={line.variantId}
              className={line.collected ? "is-collected" : "is-pending"}
            >
              <span>
                {line.productName} — {line.variantDescription} ({line.sku})
              </span>
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  max={line.availableStock}
                  value={line.quantity}
                  onChange={(event) =>
                    changeQuantity(line.variantId, Number.parseInt(event.target.value, 10))
                  }
                />
              </label>
              <span>{formatPaise(line.unitPricePaise * line.quantity)}</span>
              <label>
                <input
                  type="checkbox"
                  checked={line.collected}
                  onChange={() => setLines(toggleCollected(lines, line.variantId))}
                />
                Collected
              </label>
              <button
                type="button"
                onClick={() => setLines(removeBasketLine(lines, line.variantId))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <p className="counter-progress" aria-live="polite">
          {progress}
        </p>
        {lines.length > 0 && hasUncollectedLines(lines) ? (
          <p className="counter-warning">Some items are not yet collected.</p>
        ) : null}

        <p className="counter-total">
          Estimated total (server confirms at checkout):{" "}
          <strong>{formatPaise(total)}</strong>
        </p>

        <fieldset className="counter-method">
          <legend>Payment method</legend>
          <label>
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={method === "cash"}
              onChange={() => setMethod("cash")}
            />
            Cash
          </label>
          <label>
            <input
              type="radio"
              name="paymentMethod"
              value="online"
              checked={method === "online"}
              onChange={() => setMethod("online")}
            />
            Online
          </label>
        </fieldset>

        {method === "cash" ? (
          <div className="counter-cash-fields">
            <label>
              Cash received (₹)
              <input
                inputMode="decimal"
                value={cashInput}
                onChange={(event) => setCashInput(event.target.value)}
              />
            </label>
            <p>
              Change due:{" "}
              {cashChangeDuePaise(cashInput, total) === null
                ? "—"
                : formatPaise(cashChangeDuePaise(cashInput, total) as number)}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          className="primary-button"
          onClick={submit}
          disabled={checkoutDisabled}
        >
          {submitting
            ? "Working…"
            : method === "cash"
              ? "Take cash payment"
              : "Create online payment"}
        </button>
      </section>
    </div>
  );
}
