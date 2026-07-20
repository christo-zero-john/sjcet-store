import { formatPaise } from "../../lib/money/paise";
import type { OrderDetail } from "../orders/queries";

/**
 * Store-operator order detail. Shows frozen lines, totals, payment attempts,
 * manager and claim identities, timestamps, and the append-only activity trail.
 * Paid order content is read-only.
 */
export function OrderDetailView({ detail }: { detail: OrderDetail }) {
  const { order } = detail;
  return (
    <section className="order-detail" aria-labelledby="order-detail-title">
      <h1 id="order-detail-title">Order #{order.orderNumber}</h1>
      <dl className="order-detail-meta">
        <div>
          <dt>Status</dt>
          <dd>{order.status}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{order.paymentMethod}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{detail.createdBy}</dd>
        </div>
        <div>
          <dt>Claimed by</dt>
          <dd>{detail.studentId ?? "—"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{detail.paidAt ? new Date(detail.paidAt).toLocaleString() : "—"}</dd>
        </div>
      </dl>

      <table className="order-detail-lines">
        <caption>Frozen order lines</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">SKU</th>
            <th scope="col">Unit price</th>
            <th scope="col">Qty</th>
            <th scope="col">Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.productName} — {line.variantDescription}
              </td>
              <td>{line.sku}</td>
              <td>{formatPaise(line.unitPricePaise)}</td>
              <td>{line.quantity}</td>
              <td>{formatPaise(line.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4}>
              Total
            </th>
            <td>{formatPaise(order.totalPaise)}</td>
          </tr>
        </tfoot>
      </table>

      <h2>Payment attempts</h2>
      <ul className="order-detail-attempts">
        {detail.attempts.map((attempt) => (
          <li key={attempt.id}>
            {attempt.method} · {attempt.status} · {formatPaise(attempt.amountPaise)}
            {attempt.provider ? ` · ${attempt.provider}` : ""}
            {attempt.reconciliationCode ? ` · ${attempt.reconciliationCode}` : ""}
          </li>
        ))}
      </ul>

      <h2>Activity</h2>
      <ol className="order-detail-activity">
        {detail.activity.map((entry, index) => (
          <li key={`${entry.action}-${index}`}>
            <time dateTime={entry.createdAt}>
              {new Date(entry.createdAt).toLocaleString()}
            </time>{" "}
            {entry.action}
          </li>
        ))}
      </ol>

      {order.status === "paid" || order.status === "fulfilled" ? (
        <a className="order-detail-bill" href={`/store-manager/orders/${order.id}/bill`}>
          Print bill
        </a>
      ) : null}
    </section>
  );
}
