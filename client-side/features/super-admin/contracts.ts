export type ActiveStoreManager = Readonly<{
  user_id: string;
  email: string;
  display_name: string | null;
  assigned_at: string;
}>;

export type PendingStoreManagerInvitation = Readonly<{
  email: string;
  display_name: string | null;
  state: "pending" | "failed";
  invited_at: string;
  last_sent_at: string;
  failure_code: string | null;
}>;

export type StoreManagerAccessSnapshot = Readonly<{
  active: readonly ActiveStoreManager[];
  pending: readonly PendingStoreManagerInvitation[];
}>;

export type StoreManagerAccessRequest = Readonly<{
  state: "active" | "pending";
  email?: string;
  user_id?: string;
  requires_auth_invite: boolean;
}>;
