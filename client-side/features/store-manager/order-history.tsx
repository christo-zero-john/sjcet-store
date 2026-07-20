import { formatPaise } from "../../lib/money/paise";
import type {
  OrderHistoryPage,
  OrderHistoryQuery,
} from "../orders/queries";

function buildNextHref(query: OrderHistoryQuery, cursor: string): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.paymentMethod) params.set("paymentMethod", query.paymentMethod);
  if (query.orderState) params.set("orderState", query.orderState);
  if (query.paymentState) params.set("paymentState", query.paymentState);
  if (query.fromDate) params.set("fromDate", query.fromDate);
  if (query.toDate) params.set("toDate", query.toDate);
  params.set("cursor", cursor);
  return `?${params.toString()}`;
}

/**
 * Server-paginated order history. Filters submit through the URL and the server
 * returns only the current page; the browser never filters a full dataset.
 */
export function OrderHistory({
  page,
  query,
}: {
  page: OrderHistoryPage;
  query: OrderHistoryQuery;
}) {
  return (
    <section className="order-history" aria-labelledby="order-history-title">
      <h1 id="order-history-title">Orders</h1>

      <form method="get" className="order-history-filters" role="search">
        <label>
          Order number
          <input name="search" defaultValue={query.search ?? ""} inputMode="numeric" />
        </label>
        <label>
          Payment method
          <select name="paymentMethod" defaultValue={query.paymentMethod ?? ""}>
            <option value="">Any</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>
        </label>
        <label>
          Order state
          <select name="orderState" defaultValue={query.orderState ?? ""}>
            <option value="">Any</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="paid">Paid</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Payment state
          <select name="paymentState" defaultValue={query.paymentState ?? ""}>
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          From
          <input type="date" name="fromDate" defaultValue={query.fromDate?.slice(0, 10) ?? ""} />
        </label>
        <label>
          To
          <input type="date" name="toDate" defaultValue={query.toDate?.slice(0, 10) ?? ""} />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      {page.rows.length === 0 ? (
        <p className="order-history-empty">No orders match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Status</th>
              <th scope="col">Method</th>
              <th scope="col">Total</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`/store-manager/orders/${row.id}`}>#{row.orderNumber}</a>
                </td>
                <td>{row.status}</td>
                <td>{row.paymentMethod}</td>
                <td>{formatPaise(row.totalPaise)}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {page.nextCursor ? (
        <a className="order-history-next" href={buildNextHref(query, page.nextCursor)}>
          Next page
        </a>
      ) : null}
    </section>
  );
}
