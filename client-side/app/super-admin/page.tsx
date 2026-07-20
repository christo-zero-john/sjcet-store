import { requireSuperAdmin } from "../../features/auth/authorization";
import {
  addStoreManager,
  cancelStoreManagerInvitation,
  removeStoreManager,
  resendStoreManagerInvitation,
} from "../../features/super-admin/actions";
import type { StoreManagerAccessSnapshot } from "../../features/super-admin/contracts";
import { ManagerAccessPanel } from "../../features/super-admin/manager-access-panel";

type SuperAdminPageProps = Readonly<{
  searchParams: Promise<{ error?: string; message?: string }>;
}>;

export default async function SuperAdminPage({
  searchParams,
}: SuperAdminPageProps) {
  const { supabase } = await requireSuperAdmin();
  const params = await searchParams;
  const { data, error } = await supabase.rpc("list_store_manager_access");
  const snapshot = (data ?? {
    active: [],
    pending: [],
  }) as StoreManagerAccessSnapshot;

  return (
    <main className="super-admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Super Admin dashboard</h1>
          <p>Create and maintain access for college store managers.</p>
        </div>
      </header>
      {params.message ? (
        <p aria-live="polite" className="notice">
          {params.message}
        </p>
      ) : null}
      {params.error || error ? (
        <p aria-live="polite" className="notice is-error">
          {params.error ?? error?.message}
        </p>
      ) : null}
      <ManagerAccessPanel
        active={snapshot.active}
        addAction={addStoreManager}
        cancelAction={cancelStoreManagerInvitation}
        pending={snapshot.pending}
        removeAction={removeStoreManager}
        resendAction={resendStoreManagerInvitation}
      />
    </main>
  );
}
