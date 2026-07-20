import { notFound } from "next/navigation";

import { requireStoreOperator } from "../../../../../features/auth/authorization";
import { Bill } from "../../../../../features/orders/bill";
import { getOrderDetail } from "../../../../../features/orders/queries";

export const metadata = { title: "Order bill" };

type BillPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function BillPage({ params }: BillPageProps) {
  await requireStoreOperator();
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) {
    notFound();
  }

  return <Bill order={detail.order} paidAt={detail.paidAt} />;
}
