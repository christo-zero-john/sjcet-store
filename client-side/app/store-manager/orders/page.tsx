import { requireStoreOperator } from "../../../features/auth/authorization";
import {
  getOrderHistory,
  normalizeOrderHistoryQuery,
} from "../../../features/orders/queries";
import { OrderHistory } from "../../../features/store-manager/order-history";

export const metadata = { title: "Orders" };

type OrdersPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireStoreOperator();
  const query = normalizeOrderHistoryQuery(await searchParams);
  const page = await getOrderHistory(query);

  return (
    <main className="store-records-page">
      <OrderHistory page={page} query={query} />
    </main>
  );
}
