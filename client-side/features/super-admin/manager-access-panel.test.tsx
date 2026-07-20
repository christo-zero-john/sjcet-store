import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManagerAccessPanel } from "./manager-access-panel";

describe("manager access panel", () => {
  it("shows manager creation and active and pending access states", () => {
    const markup = renderToStaticMarkup(
      <ManagerAccessPanel
        active={[
          {
            user_id: "manager-1",
            email: "manager@store.sjcetpalai.ac.in",
            display_name: "Store Manager",
            assigned_at: "2026-07-18T00:00:00Z",
          },
        ]}
        pending={[
          {
            email: "pending@store.sjcetpalai.ac.in",
            display_name: null,
            state: "pending",
            invited_at: "2026-07-18T00:00:00Z",
            last_sent_at: "2026-07-18T00:00:00Z",
            failure_code: null,
          },
        ]}
      />,
    );

    expect(markup).toContain("Add store manager");
    expect(markup).toContain("Search managers");
    expect(markup).toContain("Store Manager");
    expect(markup).toContain("Pending");
    expect(markup).toContain("Remove access");
    expect(markup).toContain("Resend");
    expect(markup).toContain("Cancel invitation");
  });
});
