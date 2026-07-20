"use client";

import { useMemo, useState } from "react";

import type {
  ActiveStoreManager,
  PendingStoreManagerInvitation,
} from "./contracts";

type FormAction = (formData: FormData) => void | Promise<void>;

type ManagerAccessPanelProps = Readonly<{
  active: readonly ActiveStoreManager[];
  pending: readonly PendingStoreManagerInvitation[];
  addAction?: FormAction;
  resendAction?: FormAction;
  cancelAction?: FormAction;
  removeAction?: FormAction;
}>;

export function ManagerAccessPanel({
  active,
  pending,
  addAction,
  resendAction,
  cancelAction,
  removeAction,
}: ManagerAccessPanelProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredActive = useMemo(
    () =>
      active.filter((manager) =>
        `${manager.display_name ?? ""} ${manager.email}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    [active, normalizedQuery],
  );
  const filteredPending = useMemo(
    () =>
      pending.filter((invitation) =>
        `${invitation.display_name ?? ""} ${invitation.email}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery, pending],
  );
  function confirmSubmission(
    event: React.FormEvent<HTMLFormElement>,
    message: string,
  ) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <div className="access-workspace">
      <section className="workspace-card">
        <div className="section-heading">
          <div>
            <span>Access</span>
            <h2>Add store manager</h2>
          </div>
        </div>
        <form action={addAction} className="form-grid">
          <label>
            College email
            <input
              autoComplete="email"
              name="email"
              placeholder="manager@store.sjcetpalai.ac.in"
              required
              type="email"
            />
          </label>
          <label>
            Display name (optional)
            <input autoComplete="name" name="displayName" />
          </label>
          <div className="wide-field">
            <button className="primary-button" type="submit">
              Add store manager
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-card">
        <div className="section-heading manager-access-heading">
          <div>
            <span>People</span>
            <h2>Store managers</h2>
          </div>
          <label className="manager-search">
            Search managers
            <input
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              value={query}
            />
          </label>
        </div>

        <div className="access-summary" aria-label="Access summary">
          <span>{active.length} active</span>
          <span>{pending.length} pending</span>
        </div>

        <div className="access-list">
          {filteredActive.map((manager) => (
            <article className="access-row" key={manager.user_id}>
              <div>
                <strong>{manager.display_name ?? manager.email}</strong>
                <p>{manager.email}</p>
                <span className="status-badge is-active">Active</span>
              </div>
              <form
                action={removeAction}
                onSubmit={(event) =>
                  confirmSubmission(
                    event,
                    `Remove store-manager access from ${manager.email}?`,
                  )
                }
              >
                <input name="userId" type="hidden" value={manager.user_id} />
                <button className="danger-button" type="submit">
                  Remove access
                </button>
              </form>
            </article>
          ))}

          {filteredPending.map((invitation) => (
            <article className="access-row" key={invitation.email}>
              <div>
                <strong>{invitation.display_name ?? invitation.email}</strong>
                <p>{invitation.email}</p>
                <span
                  className={`status-badge ${
                    invitation.state === "failed" ? "is-error" : "is-pending"
                  }`}
                >
                  {invitation.state === "failed" ? "Send failed" : "Pending"}
                </span>
              </div>
              <div className="row-actions">
                <form action={resendAction}>
                  <input name="email" type="hidden" value={invitation.email} />
                  <button className="secondary-button" type="submit">
                    Resend
                  </button>
                </form>
                <form
                  action={cancelAction}
                  onSubmit={(event) =>
                    confirmSubmission(
                      event,
                      `Cancel the invitation for ${invitation.email}?`,
                    )
                  }
                >
                  <input name="email" type="hidden" value={invitation.email} />
                  <button className="danger-button" type="submit">
                    Cancel invitation
                  </button>
                </form>
              </div>
            </article>
          ))}

          {filteredActive.length === 0 && filteredPending.length === 0 ? (
            <p className="empty-state">No managers match this search.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
