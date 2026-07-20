import { redirect } from "next/navigation";

import { claimPaymentHandoff } from "../../../features/payments/actions";
import {
  PaymentHandoffUnavailable,
  PaymentHandoffView,
} from "../../../features/payments/payment-handoff-view";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const metadata = {
  title: "Secure payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

type PayHandoffPageProps = Readonly<{
  params: Promise<{ token: string }>;
}>;

export default async function PayHandoffPage({ params }: PayHandoffPageProps) {
  const { token } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent(`/pay/${token}`)}`);
  }

  const result = await claimPaymentHandoff(token);
  if (!result.ok) {
    return <PaymentHandoffUnavailable />;
  }

  return <PaymentHandoffView view={result.data} token={token} />;
}
