import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrderHistory } from "./order-history";
import { PaymentHistory } from "./payment-history";
import type {
  OrderHistoryPage,
  OrderHistoryQuery,
  PaymentHistoryPage,
} from "../orders/queries";

const query: OrderHistoryQuery = {
  search: null,
  paymentMethod: null,
  orderState: null,
  paymentState: null,
  fromDate: null,
  toDate: null,
  limit: 20,
  cursor: null,
};

describe("OrderHistory", () => {
  it("renders filter controls and order links", () => {
    const page: OrderHistoryPage = {
      rows: [
        {
          id: "order-1",
          orderNumber: 1042,
          status: "fulfilled",
          paymentMethod: "cash",
          totalPaise: 2500,
          createdAt: "2026-07-19T10:00:00.000Z",
          paidAt: "2026-07-19T10:00:00.000Z",
        },
      ],
      nextCursor: "CURSOR",
    };
    const markup = renderToStaticMarkup(<OrderHistory page={page} query={query} />);

    expect(markup).toContain('name="paymentMethod"');
    expect(markup).toContain('name="orderState"');
    expect(markup).toContain('name="paymentState"');
    expect(markup).toContain('href="/store-manager/orders/order-1"');
    expect(markup).toContain("Next page");
    expect(markup).toContain('method="get"');
  });

  it("shows an empty state", () => {
    const markup = renderToStaticMarkup(
      <OrderHistory page={{ rows: [], nextCursor: null }} query={query} />,
    );
    expect(markup).toContain("No orders match these filters.");
  });
});

describe("PaymentHistory", () => {
  const page: PaymentHistoryPage = {
    rows: [
      {
        id: "attempt-1",
        method: "online",
        status: "succeeded",
        provider: "dodo",
        providerCheckoutId: "sess_secret",
        providerPaymentId: "pay_1",
        amountPaise: 2500,
        cashReceivedPaise: null,
        changeDuePaise: null,
        reconciliationCode: null,
        reconciliationMessage: null,
        failureCode: null,
        createdAt: "2026-07-19T10:00:00.000Z",
        succeededAt: "2026-07-19T10:01:00.000Z",
        orderId: "order-1",
        orderNumber: 1042,
      },
    ],
    nextCursor: null,
  };

  it("shows safe reconciliation fields but not secrets", () => {
    const markup = renderToStaticMarkup(<PaymentHistory page={page} />);
    expect(markup).toContain("dodo");
    expect(markup).toContain("#1042");
    expect(markup).not.toContain("sess_secret");
    expect(markup).not.toContain("checkout_url");
    expect(markup).not.toContain("token_sha256");
  });
});
