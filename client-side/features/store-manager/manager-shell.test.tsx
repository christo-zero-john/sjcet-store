import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManagerShell } from "./manager-shell";

describe("store manager shell", () => {
  it("groups daily work separately from catalog maintenance", () => {
    const markup = renderToStaticMarkup(
      <ManagerShell userEmail="manager@store.sjcetpalai.ac.in">
        <p>Dashboard</p>
      </ManagerShell>,
    );

    expect(markup).toContain("Daily work");
    expect(markup).toContain("Maintenance");
    expect(markup).toContain("Catalog settings");
    expect(markup).toContain("Products");
    expect(markup).toContain("Inventory");
    expect(markup).toContain("Payments");
    expect(markup).toContain("Counter sale");
    expect(markup).toContain("Orders");
    expect(markup).toContain("manager@store.sjcetpalai.ac.in");
  });
});
