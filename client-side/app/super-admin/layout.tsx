import Link from "next/link";
import type { ReactNode } from "react";

import { requireSuperAdmin } from "../../features/auth/authorization";
import { signOut } from "../../features/auth/actions";

export default async function SuperAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user } = await requireSuperAdmin();

  return (
    <div className="super-admin-shell">
      <header className="super-admin-bar">
        <div>
          <p className="eyebrow">SJCET Store</p>
          <strong>Super Admin</strong>
        </div>
        <nav aria-label="Super admin navigation">
          <Link href="/super-admin">User access</Link>
          <Link href="/store-manager/products">Open store manager</Link>
        </nav>
        <div className="super-admin-account">
          <span>{user.email}</span>
          <form action={signOut}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
