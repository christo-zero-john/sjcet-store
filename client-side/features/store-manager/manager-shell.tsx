import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../auth/actions";

type ManagerShellProps = Readonly<{
  children: ReactNode;
  userEmail: string;
}>;

const NAVIGATION = [
  {
    label: "Daily work",
    items: [
      { href: "/store-manager/products", label: "Products" },
      { href: "/store-manager/inventory", label: "Inventory" },
      { href: "/store-manager/orders", label: "Orders" },
      { href: "/store-manager/payments", label: "Payments" },
      { href: "/store-manager/orders/new", label: "Counter sale" },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { href: "/store-manager/categories", label: "Catalog settings" },
    ],
  },
] as const;

export function ManagerShell({ children, userEmail }: ManagerShellProps) {
  return (
    <div className="manager-layout">
      <aside className="manager-sidebar">
        <Link className="manager-brand" href="/store-manager">
          <span>SJCET</span>
          Store manager
        </Link>
        <nav aria-label="Store manager">
          {NAVIGATION.map((group) => (
            <div className="manager-nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="manager-account">
          <span>{userEmail}</span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="manager-main">{children}</main>
    </div>
  );
}
