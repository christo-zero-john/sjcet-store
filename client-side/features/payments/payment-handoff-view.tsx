import { formatPaise } from "../../lib/money/paise";
import type { ClaimantOrderView } from "./actions";

const PAYMENT_STATE_LABELS: Readonly<Record<string, string>> = {
  pending: "Waiting for payment",
  processing: "Payment processing",
  succeeded: "Paid",
  failed: "Payment failed",
  cancelled: "Payment cancelled",
};

/**
 * Read-only shared orders/payments handoff surface. It shows the frozen order
 * and a provider-neutral "Pay securely" action. It never renders manager
 * controls, internal identifiers, secrets, or raw provider data.
 */
export function PaymentHandoffView({
  view,
  token,
}: {
  view: ClaimantOrderView;
  token: string;
}) {
  const payable = view.status === "awaiting_payment";
  const stateLabel = PAYMENT_STATE_LABELS[view.paymentState] ?? view.paymentState;

  return (
    <main className="pay-handoff">
      <h1>Order #{view.orderNumber}</h1>
      <p className="pay-status" role="status">
        {stateLabel}
      </p>

      <table>
        <caption>Order summary</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Unit price</th>
            <th scope="col">Qty</th>
            <th scope="col">Line total</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line, index) => (
            <tr key={`${line.sku}-${index}`}>
              <td>
                {line.productName} — {line.variantDescription} ({line.sku})
              </td>
              <td>{formatPaise(line.unitPricePaise)}</td>
              <td>{line.quantity}</td>
              <td>{formatPaise(line.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total
            </th>
            <td>{formatPaise(view.totalPaise)}</td>
          </tr>
        </tfoot>
      </table>

      {payable ? (
        <a className="primary-button pay-securely" href={`/pay/${token}/checkout`}>
          Pay securely
        </a>
      ) : (
        <p className="pay-closed">This order is no longer awaiting payment.</p>
      )}
    </main>
  );
}

export function PaymentHandoffUnavailable() {
  return (
    <main className="pay-handoff">
      <h1>Payment link unavailable</h1>
      <p>This payment link is invalid, expired, or already in use.</p>
    </main>
  );
}
