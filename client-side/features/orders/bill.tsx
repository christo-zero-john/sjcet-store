import { formatPaise } from "../../lib/money/paise";
import type { FrozenOrder } from "./contracts";

const PAID_STATES = new Set(["paid", "fulfilled"]);

export function isBillPrintable(order: FrozenOrder): boolean {
  return PAID_STATES.has(order.status);
}

type BillProps = Readonly<{
  order: FrozenOrder;
  paidAt: string | null;
}>;

/**
 * Print-safe bill built only from frozen order snapshots. Later product,
 * variant, SKU, or price edits never change it. Unpaid or cancelled orders
 * cannot be represented as a paid bill.
 */
export function Bill({ order, paidAt }: BillProps) {
  if (!isBillPrintable(order)) {
    return (
      <main className="order-bill order-bill--closed">
        <p>
          Order #{order.orderNumber} is not paid, so a bill cannot be printed.
        </p>
      </main>
    );
  }

  return (
    <main className="order-bill">
      <header className="order-bill-head">
        <h1>SJCET Store</h1>
        <p>Bill for order #{order.orderNumber}</p>
        <p className="order-bill-paid">Paid</p>
        <p>Payment method: {order.paymentMethod}</p>
        {paidAt ? <p>Paid at: {new Date(paidAt).toLocaleString()}</p> : null}
      </header>

      <table>
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
    </main>
  );
}
