import { formatPaise } from "../../lib/money/paise";
import type { PaymentHistoryPage } from "../orders/queries";

/**
 * Payment reconciliation list. Shows method, provider, state, amount, order,
 * timings, and safe failure/reconciliation fields. Raw webhook payloads,
 * secrets, token hashes, and full checkout URLs are never UI contracts.
 */
export function PaymentHistory({ page }: { page: PaymentHistoryPage }) {
  return (
    <section className="payment-history" aria-labelledby="payment-history-title">
      <h1 id="payment-history-title">Payments</h1>

      {page.rows.length === 0 ? (
        <p className="payment-history-empty">No payments to show.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Method</th>
              <th scope="col">Provider</th>
              <th scope="col">State</th>
              <th scope="col">Amount</th>
              <th scope="col">Created</th>
              <th scope="col">Succeeded</th>
              <th scope="col">Reconciliation</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`/store-manager/orders/${row.orderId}`}>
                    #{row.orderNumber}
                  </a>
                </td>
                <td>{row.method}</td>
                <td>{row.provider ?? "—"}</td>
                <td>{row.status}</td>
                <td>{formatPaise(row.amountPaise)}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>
                  {row.succeededAt
                    ? new Date(row.succeededAt).toLocaleString()
                    : "—"}
                </td>
                <td>
                  {row.reconciliationCode ?? row.failureCode ?? "—"}
                  {row.reconciliationMessage ? (
                    <span className="payment-reconciliation-message">
                      {" "}
                      {row.reconciliationMessage}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
