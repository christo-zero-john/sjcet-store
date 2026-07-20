import type { ReactNode } from "react";

import { requireStoreOperator } from "../../features/auth/authorization";
import { ManagerShell } from "../../features/store-manager/manager-shell";

export default async function StoreManagerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user } = await requireStoreOperator();

  return (
    <ManagerShell userEmail={user.email ?? "Signed-in user"}>
      {children}
    </ManagerShell>
  );
}
