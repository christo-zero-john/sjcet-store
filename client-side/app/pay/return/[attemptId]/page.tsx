import { redirect } from "next/navigation";

import { getPaymentReturnStatus } from "../../../../features/payments/actions";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "We are waiting for your payment to confirm.",
  processing: "Your payment is processing.",
  succeeded: "Your payment succeeded. Thank you!",
  failed: "Your payment did not go through.",
  cancelled: "This payment was cancelled.",
};

type PayReturnPageProps = Readonly<{
  params: Promise<{ attemptId: string }>;
}>;

// The provider return is status-only. Query parameters never mark an order
// paid; the authoritative state comes from the server.
export default async function PayReturnPage({ params }: PayReturnPageProps) {
  const { attemptId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const status = await getPaymentReturnStatus(attemptId);

  return (
    <main className="pay-return">
      <h1>Payment status</h1>
      {status.ok ? (
        <>
          <p role="status">
            {STATUS_LABELS[status.data.paymentState] ??
              "We are checking your payment."}
          </p>
          <p>Order #{status.data.orderNumber}</p>
        </>
      ) : (
        <p role="status">We could not find this payment.</p>
      )}
      <p className="pay-return-refresh">
        Refresh this page to check for the latest confirmed status.
      </p>
    </main>
  );
}
