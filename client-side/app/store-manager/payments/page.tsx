import { requireStoreOperator } from "../../../features/auth/authorization";
import {
  getPaymentHistory,
  normalizeOrderHistoryQuery,
} from "../../../features/orders/queries";
import { PaymentHistory } from "../../../features/store-manager/payment-history";

export const metadata = { title: "Payments" };

type PaymentsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireStoreOperator();
  const query = normalizeOrderHistoryQuery(await searchParams);
  const page = await getPaymentHistory(query);

  return (
    <main className="store-records-page">
      <PaymentHistory page={page} />
    </main>
  );
}
