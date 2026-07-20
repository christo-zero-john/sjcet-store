import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ClaimantOrderView } from "./actions";
import {
  PaymentHandoffUnavailable,
  PaymentHandoffView,
} from "./payment-handoff-view";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const view: ClaimantOrderView = {
  orderNumber: 1042,
  status: "awaiting_payment",
  currency: "INR",
  totalPaise: 2500,
  paymentState: "pending",
  lines: [
    {
      productName: "Gel Pen",
      variantDescription: "Blue",
      sku: "PEN-BLUE",
      quantity: 2,
      unitPricePaise: 1250,
      lineTotalPaise: 2500,
    },
  ],
};

describe("PaymentHandoffView", () => {
  const markup = renderToStaticMarkup(
    <PaymentHandoffView view={view} token="raw-token" />,
  );

  it("shows the order number, lines, total, and Pay securely", () => {
    expect(markup).toContain("Order #1042");
    expect(markup).toContain("Gel Pen");
    expect(markup).toContain("Pay securely");
    expect(markup).toContain('href="/pay/raw-token/checkout"');
  });

  it("never exposes internal ids or provider data", () => {
    expect(markup).not.toContain("checkout_url");
    expect(markup).not.toContain("dodopayments");
    expect(markup).not.toContain("token_sha256");
  });

  it("hides Pay securely for a non-payable order", () => {
    const closed = renderToStaticMarkup(
      <PaymentHandoffView
        view={{ ...view, status: "paid", paymentState: "succeeded" }}
        token="raw-token"
      />,
    );
    expect(closed).not.toContain("Pay securely");
  });

  it("renders one generic message for an unavailable handoff", () => {
    const markup2 = renderToStaticMarkup(<PaymentHandoffUnavailable />);
    expect(markup2).toContain("Payment link unavailable");
  });
});

describe("handoff route boundaries", () => {
  it("redirects unauthenticated visitors with a validated next path", () => {
    const page = source("../../app/pay/[token]/page.tsx");
    expect(page).toContain("next=");
    expect(page).toContain("claimPaymentHandoff");
  });

  it("never accepts a provider url from the request", () => {
    const route = source("../../app/pay/[token]/checkout/route.ts");
    expect(route).toContain("getPaymentRedirectUrl");
    expect(route).not.toContain("searchParams.get");
    expect(route).toMatch(/https/u);
    expect(route).toContain("no-store");
  });

  it("treats the provider return as status only", () => {
    const returnPage = source("../../app/pay/return/[attemptId]/page.tsx");
    expect(returnPage).toContain("getPaymentReturnStatus");
    expect(returnPage).not.toContain("process_online_payment_event");
    expect(returnPage).not.toContain("completeCash");
  });
});
