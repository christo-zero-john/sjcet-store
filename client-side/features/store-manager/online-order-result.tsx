"use client";

import { formatPaise } from "../../lib/money/paise";
import type { OnlineOrderResult } from "../orders/contracts";

type OnlineOrderResultViewProps = Readonly<{
  result: OnlineOrderResult;
  statusLabel: string;
  canRotate: boolean;
  pending: boolean;
  onRotate: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onNewSale: () => void;
}>;

/**
 * Manager-only online result: order summary, application QR, copyable handoff
 * URL, live payment status, and cancel/rotate controls. The provider checkout
 * URL is never rendered.
 */
export function OnlineOrderResultView({
  result,
  statusLabel,
  canRotate,
  pending,
  onRotate,
  onRefresh,
  onCancel,
  onNewSale,
}: OnlineOrderResultViewProps) {
  const { order } = result;

  return (
    <section className="counter-online-result" aria-labelledby="online-result-title">
      <h2 id="online-result-title">Order #{order.orderNumber} awaiting payment</h2>

      <div className="counter-online-grid">
        <div className="counter-qr">
          {/* Inline data-URL QR generated server-side; next/image adds no value here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrDataUrl}
            alt={`Payment QR code for order number ${order.orderNumber}. Scan to pay ${formatPaise(order.totalPaise)}.`}
            width={320}
            height={320}
          />
          <label className="counter-handoff-url">
            Handoff link
            <input readOnly value={result.handoffUrl} aria-label="Copyable handoff link" />
          </label>
          <p className="counter-status" role="status" aria-live="polite">
            Payment status: {statusLabel}
          </p>
        </div>

        <div className="counter-online-summary">
          <table>
            <caption>Frozen order lines</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Qty</th>
                <th scope="col">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.productName} — {line.variantDescription} ({line.sku})
                  </td>
                  <td>{line.quantity}</td>
                  <td>{formatPaise(line.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Total
                </th>
                <td>{formatPaise(order.totalPaise)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="counter-online-actions">
            <button type="button" onClick={onRefresh} disabled={pending}>
              Refresh status
            </button>
            <button
              type="button"
              onClick={onRotate}
              disabled={pending || !canRotate}
              title={
                canRotate
                  ? "Reissue the QR if you lost the link"
                  : "A claimed or completed handoff cannot be reissued"
              }
            >
              Reissue QR
            </button>
            <button type="button" onClick={onCancel} disabled={pending}>
              Cancel order
            </button>
            <button type="button" onClick={onNewSale} disabled={pending}>
              Start another sale
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
