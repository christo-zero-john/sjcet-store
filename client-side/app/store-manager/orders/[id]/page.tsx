import { notFound } from "next/navigation";

import { requireStoreOperator } from "../../../../features/auth/authorization";
import { getOrderDetail } from "../../../../features/orders/queries";
import { OrderDetailView } from "../../../../features/store-manager/order-detail";

export const metadata = { title: "Order detail" };

type OrderDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireStoreOperator();
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) {
    notFound();
  }

  return (
    <main className="store-records-page">
      <OrderDetailView detail={detail} />
    </main>
  );
}
